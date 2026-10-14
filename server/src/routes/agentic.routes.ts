import { Router, Request, Response } from 'express';
import { agentOrchestrator, promoterAutonService, venueBrainService, guestFinderService, revenueMaxService } from '../services/agentic.service';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/permissions';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';

const router = Router();

/**
 * WHY THESE ARE ADMIN-ONLY
 *
 * `BookingVenue` has no owner. There is no column anywhere on it, and none of the
 * tables the agents write to — `GuestList`, `CoverCharge`, `BottlePackage` — carries
 * an owner either. So there is no predicate available that could answer "is this
 * caller's venue", and these routes took `venueId` straight from the request body.
 *
 * They are not read endpoints. Running an agent performs real writes: promoterAuton
 * adjusts guest-list deposits, venueBrain rewrites cover charges, revenueMax
 * reprices bottle packages. So any authenticated account could name any venue id
 * and have the platform rewrite its pricing.
 *
 * ADMIN is not a permission decision so much as the weakest available statement of
 * intent: this is platform-wide, and an operator should be the one pulling the
 * trigger.
 *
 * WHY NO OWNERSHIP COLUMN WAS ADDED INSTEAD
 *
 * The obvious fix is a `businessId` or `ownerId` on BookingVenue. That was considered
 * and deliberately not done, because it would be worse than the stopgap it replaces:
 *
 *   - Neither create path records an owner. `createVenue(data: any)` in both
 *     venue.service and nightlife.service is called with arbitrary data and stores no
 *     user context, so there is no ownership to backfill from.
 *   - Existing venues would have to be assigned an owner nobody chose. Inventing one
 *     produces rows asserting a commercial relationship that does not exist, and
 *     scoping financial writes against a fiction is precisely the failure mode the
 *     propertyScope work exists to prevent.
 *   - Whether a venue belongs to a platform Business, to an individual promoter, or is
 *     platform-listed inventory that anyone may run against is a commercial question,
 *     not a schema one. These agents reprice bottles and rewrite cover charges; who
 *     may set a club's prices is not something a route file gets to decide.
 *
 * So the route stays admin-only and says why, rather than pretending to a model that
 * does not exist. `requireVenue` below covers the part that is unambiguously correct.
 *
 * `run-all` is the same shape scaled up: it iterates every venue on the platform.
 */
const adminOnly = requireRole('ADMIN');

// ═══════════════════════════════════════════════════════════════════════════
// AGENT CONTROL PANEL — Run agents manually or on schedule
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Confirm a venue exists before pointing an agent at it.
 *
 * Not an authorisation check — see the note on `adminOnly` above, there is no ownership
 * predicate to apply because `BookingVenue` has no owner column. This is a correctness
 * check: a mistyped id used to run every agent, produce a full `AgentExecution` record
 * of decisions and price changes, and change nothing, because every write is filtered
 * by a venue that does not exist. The run reported success and updated zero rows.
 *
 * It also means the `/executions` history cannot fill with rows for venues nobody
 * ever had.
 */
async function requireVenue(venueId: unknown): Promise<string> {
  const id = typeof venueId === 'string' ? venueId.trim() : '';
  if (!id) throw new CustomError('venueId is required', 400);

  const venue = await prisma.bookingVenue.findUnique({ where: { id }, select: { id: true } });
  if (!venue) {
    // 404, not 400: the id is well-formed, there is just no such venue. The distinction
    // matters to whoever is fixing the caller's typo.
    throw new CustomError(`No venue with id ${id}`, 404);
  }
  return id;
}

// Run all agents for a venue
router.post('/venues/:venueId/run', authenticate, adminOnly, async (req: any, res: Response) => {
  try {
    const venueId = await requireVenue(req.params.venueId);
    const result = await agentOrchestrator.runAllAgents({
      agentId: `orchestrator_${venueId}_${Date.now()}`,
      agentType: 'ORCHESTRATOR',
      venueId,
      metadata: req.body,
    });
    res.json({ success: true, data: result });
  } catch (e: any) {
    const status = Number(e?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Agent execution failed' } : { error: e.message }),
    });
  }
});

// Run all agents for all venues
router.post('/run-all', authenticate, adminOnly, async (req: any, res: Response) => {
  try {
    const result = await agentOrchestrator.runAllVenues();
    res.json({ success: true, data: result });
  } catch (e: any) {
    const status = Number(e?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Agent execution failed' } : { error: e.message }),
    });
  }
});

// Run specific agent type
router.post('/:agentType/run', authenticate, adminOnly, async (req: any, res: Response) => {
  try {
    const venueId = await requireVenue(req.body?.venueId);
    const context = {
      agentId: `${req.params.agentType}_${Date.now()}`,
      agentType: req.params.agentType,
      userId: req.user?.id,
      venueId,
      promoterId: req.body.promoterId,
      metadata: req.body,
    };

    let result: any;
    switch (req.params.agentType) {
      case 'PROMOTER_AUTON':
        result = await promoterAutonService.runLoop(context);
        break;
      case 'VENUE_BRAIN':
        result = await venueBrainService.runLoop(context);
        break;
      case 'GUEST_FINDER':
        result = await guestFinderService.runLoop(context);
        break;
      case 'REVENUE_MAX':
        result = await revenueMaxService.runLoop(context);
        break;
      default:
        return res.status(400).json({ error: 'Unknown agent type' });
    }

    res.json({ success: true, data: result });
  } catch (e: any) {
    const status = Number(e?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Agent execution failed' } : { error: e.message }),
    });
  }
});

/**
 * GET /api/v1/agents/executions
 *
 * The agent control panel has called this since it was written and no such route was
 * ever registered, so it received a 404 and rendered an empty history for every
 * agent. The rows themselves were never missing: `learn()` writes an `AgentExecution`
 * on every loop, for all four agents. The record of what the agents decided and did
 * was being written and then never readable — the same shape as every other
 * write-only column fixed in this pass.
 *
 * ADMIN for the same reason the run endpoints are: `venueId` is the only grouping
 * key these rows have and a venue has no owner, so there is no tenant predicate to
 * scope a read with either.
 */
router.get('/executions', authenticate, adminOnly, async (req: any, res: Response) => {
  try {
    const { agentType, venueId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const executions = await prisma.agentExecution.findMany({
      where: {
        ...(agentType ? { agentType: String(agentType) } : {}),
        ...(venueId ? { venueId: String(venueId) } : {}),
      },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
    res.json({ success: true, data: executions });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list executions' });
  }
});

export default router;
