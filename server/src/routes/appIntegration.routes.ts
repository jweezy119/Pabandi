/**
 * appIntegration.routes.ts — third-party app + agent integration HTTP surface.
 *
 *   POST /api/v1/apps/connect       — register an app, get a PTP-backed bearer token
 *   GET  /api/v1/apps/:id/config    — get embeddable widget config (public, scoped)
 *   POST /api/v1/agents/invoke      — invoke a Pabandi agent/tool from another app
 *                                      (pay-per-use via PAB/SOL fee deduction)
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { appIntegrationService } from '../services/appIntegration.service';

const router = Router();

// ── POST /api/v1/apps/connect ────────────────────────────────────────────────
router.post('/connect', authenticate, async (req: any, res: Response) => {
  try {
    const { appName, scopes, webhookUrl, redirectUrl } = req.body;
    if (!appName || !scopes || !Array.isArray(scopes)) {
      return res.status(400).json({ success: false, error: 'appName and scopes[] required' });
    }
    const result = await appIntegrationService.connectApp({
      appName,
      ownerUserId: req.user.id,
      scopes,
      webhookUrl,
      redirectUrl,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/apps/:id/config ──────────────────────────────────────────────
router.get('/:id/config', async (req: Request, res: Response) => {
  try {
    const config = await appIntegrationService.getAppConfig(req.params.id);
    // Mask bearer token in config responses
    return res.json({ success: true, data: config });
  } catch (e: any) {
    const code = e.message === 'app not found' ? 404 : 500;
    return res.status(code).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/agents/invoke ───────────────────────────────────────────────
router.post('/invoke', authenticate, async (req: any, res: Response) => {
  try {
    const { toolName, args = {}, maxFeePab, maxFeeSol } = req.body;
    if (!toolName) return res.status(400).json({ success: false, error: 'toolName required' });

    const result = await appIntegrationService.invokeAgent({
      appId: req.user.id,
      toolName,
      args,
      maxFeePab,
      maxFeeSol,
    });

    return res.json({ success: true, data: result });
  } catch (e: any) {
    const code = e.message === 'unknown tool' ? 404 : 500;
    return res.status(code).json({ success: false, error: e.message });
  }
});

export default router;
