import { Router } from 'express';
import { prisma } from '../utils/database';
import { getEconomyStats } from '../services/economy.service';
import { web3AgentService } from '../services/web3Agent.service';
import { computeFee, computeBurn, TOKENOMICS } from '../config/tokenomics';
import { requirePassport } from '../middleware/requirePassport.middleware';

const router = Router();

// Public: real-time $PAB circulation (burn, accrual, fees) for the Economy dashboard.
router.get('/stats', async (_req: any, res: any) => {
  try {
    const stats = await getEconomyStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to load economy stats' });
  }
});

/**
 * Public: deterministic one-command demo booking.
 * Creates two idempotent demo agents (funded in DB), runs a real executeBookingPayment,
 * and returns the value-based fee, deflationary burn, bucket allocation, and the
 * before/after delta on /economy/stats. Proves the tokenomics loop end-to-end on demand.
 *
 * On-chain transfer is skipped (no funded treasury on demo), so the simulated fallback
 * records the fee/burn/buckets purely in the DB — exactly what the dashboard shows.
 */
router.post('/demo-booking', requirePassport('act:book'), async (req: any, res: any) => {
  try {
    // Cap at the per-agent daily outflow compliance limit (100 PAB) so the demo
    // booking always clears the guard and records fee/burn/buckets.
    const amountPab = Math.min(100, Math.max(1, Math.round(Number(req.body?.amountPab) || 100)));
    const fee = computeFee(amountPab);
    const burn = computeBurn(fee);
    const net = +(fee - burn).toFixed(2);
    const allocation = {
      LP_PROVISION: +(net * TOKENOMICS.ALLOCATION.LP_PROVISION).toFixed(2),
      OPERATING: +(net * TOKENOMICS.ALLOCATION.OPERATING).toFixed(2),
      YIELD_REINVEST: +(net * TOKENOMICS.ALLOCATION.YIELD_REINVEST).toFixed(2),
      EMERGENCY: +(net * TOKENOMICS.ALLOCATION.EMERGENCY).toFixed(2),
    };

    // Idempotent demo agents (deterministic profileIds)
    const fromProfile = '__demo_payer__';
    const toProfile = '__demo_payee__';
    const topUp = amountPab + fee + 10;
    const fromAgent = await prisma.web3Agent.upsert({
      where: { profileId: fromProfile },
      update: { balancePab: { increment: topUp }, dailyOutflow: 0, dailyTransactions: 0, isActive: true },
      create: {
        profileId: fromProfile,
        walletAddress: 'demo-payer',
        encryptedPrivateKey: 'demo',
        category: 'solopreneur',
        balancePab: topUp,
        dailyOutflow: 0,
        dailyTransactions: 0,
        lastReset: new Date(),
        isActive: true,
      } as any,
    });
    const toAgent = await prisma.web3Agent.upsert({
      where: { profileId: toProfile },
      update: { dailyOutflow: 0, dailyTransactions: 0, isActive: true },
      create: {
        profileId: toProfile,
        walletAddress: 'demo-payee',
        encryptedPrivateKey: 'demo',
        category: 'solopreneur',
        balancePab: 0,
        dailyOutflow: 0,
        dailyTransactions: 0,
        lastReset: new Date(),
        isActive: true,
      } as any,
    });

    const before = await getEconomyStats();
    const result = await web3AgentService.executeBookingPayment(fromAgent as any, toAgent as any, amountPab);
    if (!result.success) {
      return res.status(200).json({ success: false, error: result.error || 'Booking failed', simulated: false, amountPab });
    }
    const after = await getEconomyStats();

    res.json({
      success: true,
      data: {
        simulated: !!result.simulated,
        amountPab,
        feePab: fee,
        burnPab: burn,
        allocation,
        delta: {
          bookings: after.bookings - before.bookings,
          feesCollected: +(after.feesCollected - before.feesCollected).toFixed(2),
          burned: +((after.burned ?? 0) - (before.burned ?? 0)).toFixed(2),
          accrualTotal: +((after.accrual.total ?? 0) - (before.accrual.total ?? 0)).toFixed(2),
        },
        stats: after,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Demo booking failed' });
  }
});

export default router;
