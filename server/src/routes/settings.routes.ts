import { Router } from 'express';
import { SettingsService } from '../services/settings.service';

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

export default router;
