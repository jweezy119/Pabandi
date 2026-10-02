import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { universalEscrowService, EscrowParty, EscrowCondition } from '../services/universal-escrow.service';
import { logger } from '../utils/logger';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { prisma } from '../utils/database';

const router = Router();

/**
 * WHY EVERYTHING HERE IS NOW AUTHENTICATED
 *
 * This router had no `authenticate` at all — only rate limiters. Verified live:
 * an unauthenticated PATCH to /:referenceId/status reached the database and
 * attempted the update (returning 500 only because that escrow did not exist).
 * So anyone could mark any escrow `released` or `refunded`, which is how escrow
 * is supposed to hold money.
 *
 * A token is not sufficient on its own: `referenceId` is a client-chosen
 * string (`POST /` takes it from the body, not a server-issued id), so an
 * authenticated user could still address another party's escrow. Every route
 * below therefore checks that the caller is a named party on the escrow.
 */

/** True when the caller is one of the escrow's parties. */
async function isParty(referenceId: string, userId: string): Promise<boolean> {
  const escrow = await prisma.universalEscrow.findUnique({
    where: { referenceId },
    select: { parties: true },
  });
  if (!escrow) return false;
  const parties = escrow.parties as { partyId?: string }[];
  return parties.some((p) => p?.partyId === userId);
}

const CreateEscrowSchema = z.object({
  referenceId: z.string().min(1),
  template: z.string().default('custom'),
  parties: z.array(z.object({
    partyId: z.string(),
    role: z.enum(['buyer', 'seller', 'broker']),
  })) as z.ZodType<EscrowParty[]>,
  amount: z.number().positive(),
  currency: z.string().default('USDC'),
  conditions: z.array(z.object({
    type: z.enum(['delivery', 'milestone', 'checkin', 'manual']),
    verify: z.record(z.any()),
  })) as z.ZodType<EscrowCondition[]>,
  deadline: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const StatusUpdateSchema = z.object({
  status: z.enum(['draft', 'funded', 'in_progress', 'conditions_met', 'released', 'disputed', 'refunded']),
});

router.post('/', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const body = CreateEscrowSchema.parse(req.body);

    const escrow = await universalEscrowService.create({
      referenceId: body.referenceId,
      template: body.template,
      parties: body.parties,
      amount: body.amount,
      currency: body.currency,
      conditions: body.conditions,
      deadline: body.deadline,
      metadata: body.metadata,
    });

    logger.info(`[UniversalEscrow] created ${escrow.referenceId} template=${escrow.template}`);

    return res.status(201).json({
      success: true,
      data: escrow,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    logger.error(`[UniversalEscrow] create error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:referenceId/status', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { referenceId } = req.params;
    const body = StatusUpdateSchema.parse(req.body);

    if (!(await isParty(referenceId, userId))) {
      // 403 rather than 404: the caller is authenticated, and a party check
      // that returns "not found" would be indistinguishable from a wrong id.
      throw new CustomError('Not a party to this escrow', 403);
    }

    const escrow = await universalEscrowService.updateStatus(referenceId, body.status);

    return res.json({
      success: true,
      data: escrow,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    // Preserve the status a CustomError carries. Without this the party check
    // below throws a 403 that the generic catch flattens to a 500, which both
    // hides the cause and misreports an authorization failure as a server fault.
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    logger.error(`[UniversalEscrow] status update error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:referenceId', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { referenceId } = req.params;
    const escrow = await universalEscrowService.getByReference(referenceId);

    if (!escrow) {
      return res.status(404).json({ success: false, error: 'Escrow not found' });
    }

    if (!(await isParty(referenceId, userId))) {
      // Amount, deadline and conditions are commercially sensitive.
      return res.status(403).json({ success: false, error: 'Not a party to this escrow' });
    }

    return res.json({
      success: true,
      data: escrow,
    });
  } catch (error: any) {
    logger.error(`[UniversalEscrow] get error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/party/:partyId', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { partyId } = req.params;
    // Was unauthenticated and enumerated any party's escrows by guessing an
    // id. Only your own.
    if (partyId !== userId) {
      return res.status(403).json({ success: false, error: 'Not your party id' });
    }

    const escrows = await universalEscrowService.listByParty(partyId);

    return res.json({
      success: true,
      data: escrows,
    });
  } catch (error: any) {
    logger.error(`[UniversalEscrow] list error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/templates', (_req: Request, res: Response) => {
  const templates = [
    {
      id: 'freelance',
      label: 'Freelance Project',
      description: 'Milestone-based escrow for freelance work',
      conditions: [
        { type: 'milestone', verify: { milestoneId: 'required' } },
      ],
    },
    {
      id: 'freight',
      label: 'Freight Shipment',
      description: 'Delivery-based escrow for freight',
      conditions: [
        { type: 'delivery', verify: { trackingId: 'required', proof: 'photo' } },
      ],
    },
    {
      id: 'booking',
      label: 'Service Booking',
      description: 'Check-in-based escrow for bookings',
      conditions: [
        { type: 'checkin', verify: { location: 'required' } },
      ],
    },
    {
      id: 'property',
      label: 'Property Lease',
      description: 'Monthly lease deposit escrow',
      conditions: [
        { type: 'manual', verify: { landlordApproval: true } },
      ],
    },
    {
      id: 'goods',
      label: 'Physical Goods',
      description: 'Delivery + inspection escrow',
      conditions: [
        { type: 'delivery', verify: { trackingId: 'required' } },
        { type: 'manual', verify: { inspectionPassed: true } },
      ],
    },
  ];

  return res.json({
    success: true,
    data: templates,
  });
});

export default router;
