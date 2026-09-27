import { Router } from 'express';
import { SettingsService } from '../services/settings.service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const data = await SettingsService.getApiKeys(businessId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const businessId = String(req.body.businessId);
    const data = await SettingsService.createApiKey(businessId, req.body.data);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const data = await SettingsService.revokeApiKey(req.params.id);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
