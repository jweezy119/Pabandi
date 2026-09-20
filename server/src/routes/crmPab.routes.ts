import { Router, Request, Response } from 'express';
import { crmPabService } from '../services/crmPab.service';
import { leasePabService } from '../services/leasePab.service';
import { authenticate } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

// ── PAB Dashboard Metrics ─────────────────────────────────────────────────────

// GET /api/v1/crm/pab/balance
router.get('/balance', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await (await import('../utils/database')).prisma.propertyManagerProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const result = await crmPabService.getManagerPabBalance(profile.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('[CrmPabRoutes] balance failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/crm/pab/staking-overview
router.get('/staking-overview', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await (await import('../utils/database')).prisma.propertyManagerProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const result = await crmPabService.getStakingOverview(profile.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('[CrmPabRoutes] staking-overview failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/crm/pab/revenue-analytics
router.get('/revenue-analytics', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await (await import('../utils/database')).prisma.propertyManagerProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const result = await crmPabService.getRevenueAnalytics(profile.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('[CrmPabRoutes] revenue-analytics failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/crm/pab/tenant-risk/:tenantId
router.get('/tenant-risk/:tenantId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await crmPabService.getTenantRiskWithPabScoring(req.params.tenantId);
    if (!result) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('[CrmPabRoutes] tenant-risk failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/pab/bulk-rewards
router.post('/bulk-rewards', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await (await import('../utils/database')).prisma.propertyManagerProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { name, description, recipients } = req.body;
    if (!name || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({ error: 'name and recipients array required' });
    }

    const result = await crmPabService.createBulkPabReward({
      managerId: profile.id,
      name,
      description,
      recipients,
    });
    res.status(201).json({ success: true, data: result });
  } catch (e: any) {
    logger.error('[CrmPabRoutes] bulk-rewards failed:', e.message);
    res.status(500).json({ error: 'Could not create bulk reward' });
  }
});

// POST /api/v1/crm/pab/bulk-rewards/:id/distribute
router.post('/bulk-rewards/:id/distribute', async (req: AuthRequest, res: Response) => {
  try {
    const result = await crmPabService.distributeBulkPabReward(req.params.id);
    res.json(result);
  } catch (e: any) {
    logger.error('[CrmPabRoutes] distribute failed:', e.message);
    res.status(500).json({ error: 'Could not distribute rewards' });
  }
});

export default router;
