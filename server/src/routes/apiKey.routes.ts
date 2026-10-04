import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { SettingsService } from '../services/settings.service';

const router = Router();
router.use(authenticate);
// AUTHENTICATED.
//
// This router had NO authentication at all — every route below was reachable by anyone
// who could reach the API, and each one takes a tenant from the query string or body.
// That is 3 routes of business financials and writes (rent generation, late fees,
// lease renewal, inspections, maintenance vendors, cashflow) with no caller identity.
//
// `router.use` rather than per-route so a route added later is covered by default. Adding
// auth per handler is how the next one ends up unprotected.



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
