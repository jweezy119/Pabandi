import { Router } from 'express';
import { SettingsService } from '../services/settings.service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const data = await SettingsService.getWebhooks(businessId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const businessId = String(req.body.businessId);
    const data = await SettingsService.createWebhook(businessId, req.body.data);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const data = await SettingsService.deleteWebhook(req.params.id);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
