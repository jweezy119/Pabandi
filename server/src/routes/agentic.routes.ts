import { Router, Request, Response } from 'express';
import { agentOrchestrator, promoterAutonService, venueBrainService, guestFinderService, revenueMaxService } from '../services/agentic.service';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/permissions';
import { prisma } from '../utils/database';

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
 * trigger. Adding a genuine venue-ownership model is the real fix and is not
 * something this file can invent — it needs a column, a migration, and a decision
 * about who owns the venues that already exist.
 *
 * `run-all` is the same shape scaled up: it iterates every venue on the platform.
 */
const adminOnly = requireRole('ADMIN');

// ═══════════════════════════════════════════════════════════════════════════
// AGENT CONTROL PANEL — Run agents manually or on schedule
// ═══════════════════════════════════════════════════════════════════════════

// Run all agents for a venue
router.post('/venues/:venueId/run', authenticate, adminOnly, async (req: any, res: Response) => {
  try {
    const result = await agentOrchestrator.runAllAgents({
      agentId: `orchestrator_${req.params.venueId}_${Date.now()}`,
      agentType: 'ORCHESTRATOR',
      venueId: req.params.venueId,
      metadata: req.body,
    });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Agent execution failed' });
  }
});

// Run all agents for all venues
router.post('/run-all', authenticate, adminOnly, async (req: any, res: Response) => {
  try {
    const result = await agentOrchestrator.runAllVenues();
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Agent execution failed' });
  }
});

// Run specific agent type
router.post('/:agentType/run', authenticate, adminOnly, async (req: any, res: Response) => {
  try {
    const context = {
      agentId: `${req.params.agentType}_${Date.now()}`,
      agentType: req.params.agentType,
      userId: req.user?.id,
      venueId: req.body.venueId,
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
    res.status(500).json({ error: e.message || 'Agent execution failed' });
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
