import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { createAgentKey, listAgentKeys, revokeAgentKey } from '../services/agentKeys.service';

const router = Router();
router.use(authenticate);

/**
 * CRM settings key management. Previously these routes did not exist and the
 *SettingsService methods behind the page were stubs that returned [] / fake
 * keys. AgentApiKey is the real key store, so use its service directly.
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await listAgentKeys(req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const name = String(req.body?.data?.name ?? req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'Key name is required' });
    // Read-only CRM integration scope by default — no money-moving scopes, so
    // no implicit unrestricted payout key can be created from a settings page.
    const key = await createAgentKey(req.user!.id, {
      name,
      scopes: ['directory', 'trust', 'proof'],
    });
    res.status(201).json(key);
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message || 'Could not create key' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const revoked = await revokeAgentKey(req.user!.id, req.params.id);
    res.json({ success: true, data: { id: revoked.id, revokedAt: revoked.revokedAt } });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message || 'Could not revoke key' });
  }
});

export default router;
