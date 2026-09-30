import { Router, Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();

router.get('/profile', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const data = await SettingsService.getBusinessProfile(businessId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const businessId = String(req.body.businessId);
    const data = await SettingsService.updateBusinessProfile(businessId, req.body.data);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const data = await SettingsService.getSettings(businessId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', async (req, res) => {
  try {
    const businessId = String(req.body.businessId);
    const data = await SettingsService.updateSettings(businessId, req.body.data);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard-layout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId || String(req.query.businessId);
    if (!businessId) return res.status(400).json({ success: false, error: 'businessId required' });

    const settings = await prisma.businessSettings.findUnique({ where: { businessId } });
    return res.json({
      success: true,
      data: {
        layout: settings?.dashboardLayout || [],
        theme: settings?.dashboardTheme || {},
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.put('/dashboard-layout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId || String(req.body.businessId);
    if (!businessId) return res.status(400).json({ success: false, error: 'businessId required' });

    const { layout, theme } = req.body;
    const settings = await prisma.businessSettings.upsert({
      where: { businessId },
      create: { businessId, dashboardLayout: layout || [], dashboardTheme: theme || {} },
      update: {
        ...(layout !== undefined && { dashboardLayout: layout }),
        ...(theme !== undefined && { dashboardTheme: theme }),
      },
    });

    return res.json({ success: true, data: settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
