import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { universalEscrowService, EscrowParty, EscrowCondition } from '../services/universal-escrow.service';
import { logger } from '../utils/logger';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

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

router.post('/', apiLimiter, async (req: Request, res: Response) => {
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

router.patch('/:referenceId/status', apiLimiter, async (req: Request, res: Response) => {
  try {
    const { referenceId } = req.params;
    const body = StatusUpdateSchema.parse(req.body);

    const escrow = await universalEscrowService.updateStatus(referenceId, body.status);

    return res.json({
      success: true,
      data: escrow,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    logger.error(`[UniversalEscrow] status update error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:referenceId', apiLimiter, async (req: Request, res: Response) => {
  try {
    const { referenceId } = req.params;
    const escrow = await universalEscrowService.getByReference(referenceId);

    if (!escrow) {
      return res.status(404).json({ success: false, error: 'Escrow not found' });
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

router.get('/party/:partyId', apiLimiter, async (req: Request, res: Response) => {
  try {
    const { partyId } = req.params;
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
