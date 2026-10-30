import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { X402_PRICING } from '../config/fees';

const router = Router();

/**
 * POST /api/v1/data-escrow/create
 * Create a data escrow: buyer deposits USDC, seller delivers verified data.
 *
 * Flow:
 *   1. Buyer creates escrow with amount + expected data hash
 *   2. Buyer funds escrow (USDC on Solana)
 *   3. Seller delivers data hash via /deliver
 *   4. Buyer (or verifier) calls /:id/verify (VCAP) — hash match releases funds
 *   5. Pabandi collects 3.5% platform fee + $0.01 VCAP verification fee
 */
const CreateDataEscrowSchema = z.object({
  sellerId: z.string().min(1, 'sellerId is required'),
  amount: z.number().positive('amount must be positive'),
  expectedDataHash: z.string().min(1, 'expectedDataHash is required'),
  description: z.string().max(280).optional(),
  deliveryDeadlineHours: z.number().int().positive().default(72),
});

router.post('/create', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const buyerId = req.user?.id;
    if (!buyerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { sellerId, amount, expectedDataHash, description, deliveryDeadlineHours } =
      CreateDataEscrowSchema.parse(req.body);

    // Verify seller exists
    const seller = await prisma.user.findUnique({ where: { id: sellerId } });
    if (!seller) {
      return res.status(404).json({ success: false, error: 'Seller not found' });
    }

    const deadline = new Date(Date.now() + deliveryDeadlineHours * 60 * 60 * 1000);
    const referenceId = `data-escrow-${cryptoRandomId()}`;

    const escrow = await prisma.universalEscrow.create({
      data: {
        referenceId,
        template: 'data-escrow',
        parties: [
          { partyId: buyerId, role: 'buyer' },
          { partyId: sellerId, role: 'seller' },
        ],
        amount,
        currency: 'USDC',
        conditions: [
          { type: 'delivery', verify: { expectedHash: expectedDataHash } },
          { type: 'timeout', verify: { deadline: deadline.toISOString() } },
        ],
        metadata: {
          dataHash: expectedDataHash,
          description,
          buyerId,
          sellerId,
          createdAt: new Date().toISOString(),
        },
        status: 'draft',
        deadline,
      },
    });

    logger.info(
      `[DataEscrow] Created ${referenceId}: buyer=${buyerId} seller=${sellerId} amount=$${amount} hash=${expectedDataHash.slice(0, 16)}...`
    );

    return res.status(201).json({
      success: true,
      data: {
        referenceId,
        escrowId: escrow.id,
        amount,
        currency: 'USDC',
        sellerId,
        buyerId,
        expectedDataHash,
        deliveryDeadline: deadline.toISOString(),
        platformFeeRate: 0.035,
        vcapFee: X402_PRICING.TRUST_API_CALL,
        instructions: {
          step1: 'Fund this escrow with USDC on Solana',
          step2: 'Seller delivers data hash via POST /api/v1/data-escrow/:id/deliver',
          step3: 'Verify via POST /api/v1/data-escrow/:id/verify (VCAP)',
          step4: 'On hash match, funds release minus 3.5% platform fee',
        },
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid request', details: error.errors });
    }
    logger.error(`[DataEscrow] Create error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/data-escrow/:id/deliver
 * Seller delivers the data hash for verification.
 */
const DeliverDataSchema = z.object({
  deliveredDataHash: z.string().min(1, 'deliveredDataHash is required'),
  sourceUrl: z.string().url().optional(),
});

router.post('/:id/deliver', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const sellerId = req.user?.id;
    if (!sellerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { deliveredDataHash, sourceUrl } = DeliverDataSchema.parse(req.body);

    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId },
    });

    if (!escrow) {
      return res.status(404).json({ success: false, error: 'Escrow not found' });
    }

    const parties = escrow.parties as unknown as Array<{ partyId: string; role: string }>;
    const isSeller = parties?.some((p) => p.partyId === sellerId && p.role === 'seller');
    if (!isSeller) {
      return res.status(403).json({ success: false, error: 'Only the seller can deliver data' });
    }

    if (escrow.status !== 'draft' && escrow.status !== 'funded') {
      return res.status(400).json({
        success: false,
        error: `Cannot deliver in status ${escrow.status}`,
      });
    }

    await prisma.universalEscrow.update({
      where: { referenceId },
      data: {
        status: 'delivered',
        metadata: {
          ...(escrow.metadata as unknown as Record<string, unknown>),
          deliveredDataHash,
          sourceUrl,
          deliveredAt: new Date().toISOString(),
          deliveredBy: sellerId,
        },
        updatedAt: new Date(),
      },
    });

    logger.info(
      `[DataEscrow] ${referenceId}: seller ${sellerId} delivered data hash ${deliveredDataHash.slice(0, 16)}...`
    );

    return res.json({
      success: true,
      data: {
        referenceId,
        status: 'delivered',
        deliveredDataHash,
        nextStep: 'Buyer calls POST /api/v1/data-escrow/:id/verify to release funds',
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid request', details: error.errors });
    }
    logger.error(`[DataEscrow] Deliver error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/data-escrow/:id — get escrow state for both parties
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const userId = req.user?.id;

    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId },
    });

    if (!escrow) {
      return res.status(404).json({ success: false, error: 'Escrow not found' });
    }

    const parties = escrow.parties as unknown as Array<{ partyId: string; role: string }>;
    const isParty = parties?.some((p) => p.partyId === userId);
    if (!isParty) {
      return res.status(403).json({ success: false, error: 'Not a party to this escrow' });
    }

    return res.json({
      success: true,
      data: {
        referenceId: escrow.referenceId,
        status: escrow.status,
        amount: escrow.amount,
        currency: escrow.currency,
        parties,
        conditions: escrow.conditions,
        metadata: escrow.metadata,
        deadline: escrow.deadline,
        createdAt: escrow.createdAt,
        updatedAt: escrow.updatedAt,
      },
    });
  } catch (error: any) {
    logger.error(`[DataEscrow] Get error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

function cryptoRandomId(): string {
  return require('crypto').randomBytes(8).toString('hex');
}

export default router;
