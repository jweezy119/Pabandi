import { Router, Request, Response } from 'express';
import { developerPortalService } from '../services/developer-portal.service';
import { ledgerService } from '../services/payment-orchestration/ledger.service';
import { logger } from '../utils/logger';

const router = Router();

// ─── API KEYS MANAGEMENT ───────────────────────────────────────────────────

/**
 * GET /api/v1/developer/keys
 * List developer API keys with secret keys masked.
 */
router.get('/keys', (_req: Request, res: Response) => {
  try {
    const keys = developerPortalService.getApiKeys();
    res.json({ success: true, data: keys });
  } catch (error: any) {
    logger.error('[DeveloperRoutes] GET /keys error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/developer/keys
 * Create a new sandbox or live API Key pair.
 */
router.post('/keys', (req: Request, res: Response) => {
  try {
    const { name, environment = 'test', scopes } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Key name is required' });
    }
    if (environment !== 'test' && environment !== 'live') {
      return res.status(400).json({ success: false, error: 'Environment must be either "test" or "live"' });
    }

    const key = developerPortalService.createApiKey({
      name,
      environment,
      scopes,
    });

    res.status(201).json({
      success: true,
      message: 'API key created successfully. Save your secret key now; it will not be shown again.',
      data: key,
    });
  } catch (error: any) {
    logger.error('[DeveloperRoutes] POST /keys error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/developer/keys/:id
 * Revoke an API Key.
 */
router.delete('/keys/:id', (req: Request, res: Response) => {
  try {
    const success = developerPortalService.revokeApiKey(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    res.json({ success: true, message: 'API key revoked successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/developer/keys/:id/roll
 * Rotate / roll the secret key of an existing API key.
 */
router.post('/keys/:id/roll', (req: Request, res: Response) => {
  try {
    const key = developerPortalService.rollApiKey(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, error: 'Active API key not found' });
    }
    res.json({
      success: true,
      message: 'Secret key rolled successfully. Copy your new secret key now.',
      data: key,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── MERCHANT SETTLEMENT & PAYOUT SETTINGS ─────────────────────────────────

/**
 * GET /api/v1/developer/settings
 * Fetch merchant payout rails and webhook configurations.
 */
router.get('/settings', (_req: Request, res: Response) => {
  try {
    const settings = developerPortalService.getSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/v1/developer/settings
 * Update merchant settlement configuration.
 */
router.put('/settings', (req: Request, res: Response) => {
  try {
    const updated = developerPortalService.updateSettings(req.body);
    res.json({ success: true, message: 'Settlement settings updated', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── WEBHOOK DISPATCH & TESTING ───────────────────────────────────────────

/**
 * GET /api/v1/developer/webhooks/deliveries
 * List recent webhook deliveries and status codes.
 */
router.get('/webhooks/deliveries', (_req: Request, res: Response) => {
  try {
    const logs = developerPortalService.getWebhookDeliveries();
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/developer/webhooks/test
 * Fire a test webhook event with cryptographic HMAC-SHA256 signature.
 */
router.post('/webhooks/test', async (req: Request, res: Response) => {
  try {
    const { targetUrl, eventType = 'payment.settled' } = req.body;
    const result = await developerPortalService.testWebhook(targetUrl, eventType);
    res.json({
      success: true,
      message: `Test webhook event '${eventType}' dispatched`,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DOUBLE-ENTRY LEDGER & RECONCILIATION ──────────────────────────────────

/**
 * GET /api/v1/developer/ledger
 * Real-time double-entry journal transactions and balance totals.
 */
router.get('/ledger', (_req: Request, res: Response) => {
  try {
    const transactions = ledgerService.getAllTransactions();
    const reconciliation = ledgerService.getReconciliationSummary();
    res.json({
      success: true,
      data: {
        transactions,
        reconciliation,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/developer/ledger/export.csv
 * Downloadable GAAP/AAOIFI reconciliation CSV for accounting.
 */
router.get('/ledger/export.csv', (_req: Request, res: Response) => {
  try {
    const csvData = ledgerService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pabandi_ledger_reconciliation_${Date.now()}.csv"`);
    res.status(200).send(csvData);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
