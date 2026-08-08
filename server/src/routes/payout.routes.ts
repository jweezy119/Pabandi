import { Router, Request, Response } from 'express';
import { payoutService } from '../services/payout.service';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();

/**
 * @route GET /api/v1/payouts/quote?amount=500
 * @desc Quote a cash-out (fee + net + savings vs remittance)
 */
router.get('/quote', authenticate, async (req: any, res) => {
  try {
    const amount = Number(req.query.amount) || 0;
    const q = await payoutService.quote(req.user.id, amount);
    res.json(q);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @route POST /api/v1/payouts/request
 * @desc Cash out earned USDC to bank / Connect account
 */
router.post('/request', authenticate, async (req: any, res) => {
  try {
    const { amountUsdc, method, destinationRef } = req.body;
    const p = await payoutService.request(req.user.id, Number(amountUsdc), (method || 'BANK') as any, destinationRef);
    res.status(201).json({ message: 'Cash-out settled', payout: p });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @route GET /api/v1/payouts/history
 * @desc Payout history
 */
router.get('/history', authenticate, async (req: any, res) => {
  try {
    const h = await payoutService.history(req.user.id);
    res.json(h);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @route POST /api/v1/payouts/migrate
 * @desc Create Payout table (Cloud Run FS read-only)
 */
router.post('/migrate', async (_req: Request, res: Response) => {
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Payout" (
      "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "amountUsdc" DOUBLE PRECISION NOT NULL,
      "feeUsdc" DOUBLE PRECISION NOT NULL, "netUsdc" DOUBLE PRECISION NOT NULL,
      "method" TEXT NOT NULL DEFAULT 'BANK', "destinationRef" TEXT, "status" TEXT NOT NULL DEFAULT 'SETTLED',
      "txHash" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
    );`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "offrampIntentId" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payout_userId_idx" ON "Payout"("userId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payout_status_idx" ON "Payout"("status")`);
    res.json({ success: true, message: 'Payout table migrated' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
