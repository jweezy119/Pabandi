import { Router, Request, Response } from 'express';
import { leasePabService } from '../services/leasePab.service';
import { authenticate } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

// ── Lease PAB Deposit ─────────────────────────────────────────────────────────

// POST /api/v1/lease-pab/deposit
router.post('/deposit', async (req: AuthRequest, res: Response) => {
  try {
    const { leaseId, depositAmount } = req.body;
    if (!leaseId || !depositAmount) {
      return res.status(400).json({ error: 'leaseId and depositAmount required' });
    }

    const result = await leasePabService.createLeaseWithPabDeposit({
      leaseId,
      tenantEmail: req.body.tenantEmail,
      depositAmount,
      userId: req.user!.id,
    });
    res.status(result.success ? 201 : 400).json(result);
  } catch (e: any) {
    logger.error('[LeasePabRoutes] deposit failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/lease-pab/deposit/:leaseId
router.get('/deposit/:leaseId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await leasePabService.getLeaseDepositStatus(req.params.leaseId);
    if (!result) return res.status(404).json({ error: 'Deposit not found' });
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('[LeasePabRoutes] get deposit failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/lease-pab/release/:leaseId
router.post('/release/:leaseId', async (req: AuthRequest, res: Response) => {
  try {
    const { earlyTermination } = req.body;
    const result = await leasePabService.returnLeaseDeposit({
      leaseId: req.params.leaseId,
      userId: req.user!.id,
      earlyTermination: !!earlyTermination,
    });
    res.json(result);
  } catch (e: any) {
    logger.error('[LeasePabRoutes] release failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PAB Payment ────────────────────────────────────────────────────────────────

// POST /api/v1/lease-pab/pay-rent
router.post('/pay-rent', async (req: AuthRequest, res: Response) => {
  try {
    const { rentPaymentId, propertyId, unitId, tokenUsed, amountUsdc, tenantEmail } = req.body;
    if (!rentPaymentId || !propertyId || !tokenUsed || !amountUsdc) {
      return res.status(400).json({ error: 'rentPaymentId, propertyId, tokenUsed, amountUsdc required' });
    }

    const result = await leasePabService.processPabPayment({
      rentPaymentId,
      tenantEmail: tenantEmail || req.user!.email,
      propertyId,
      unitId,
      amountUsdc,
      tokenUsed,
      userId: req.user!.id,
    });
    res.status(result.success ? 201 : 400).json(result);
  } catch (e: any) {
    logger.error('[LeasePabRoutes] pay-rent failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/lease-pab/payment-history
router.get('/payment-history', async (req: AuthRequest, res: Response) => {
  try {
    const { tenantEmail } = req.query;
    const email = (tenantEmail as string) || req.user!.email;
    const result = await leasePabService.getPaymentHistory(email);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('[LeasePabRoutes] payment-history failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Agent PAB Rewards ──────────────────────────────────────────────────────────

// POST /api/v1/lease-pab/agent-reward
router.post('/agent-reward', async (req: AuthRequest, res: Response) => {
  try {
    const { agentId, taskType, taskDescription, propertyId, unitId, tenantEmail, rewardAmount, autoConvert } = req.body;
    if (!agentId || !taskType || !taskDescription || !rewardAmount) {
      return res.status(400).json({ error: 'agentId, taskType, taskDescription, rewardAmount required' });
    }

    const result = await leasePabService.rewardAgentForTask({
      agentId,
      taskType,
      taskDescription,
      propertyId,
      unitId,
      tenantEmail,
      rewardAmount,
      autoConvert: !!autoConvert,
    });
    res.status(result.success ? 201 : 400).json(result);
  } catch (e: any) {
    logger.error('[LeasePabRoutes] agent-reward failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/lease-pab/agent-earnings/:agentId
router.get('/agent-earnings/:agentId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await leasePabService.getAgentPabEarnings(req.params.agentId);
    if (!result.agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('[LeasePabRoutes] agent-earnings failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
