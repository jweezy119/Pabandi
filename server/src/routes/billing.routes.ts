import { Router, Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/v1/billing/subscribe
 * Create a new billing customer with an API key.
 */
router.post('/subscribe', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyName, tier } = req.body;
    const email = req.user!.email;

    if (!companyName) {
      res.status(400).json({ success: false, error: 'companyName is required' });
      return;
    }

    const { customer, apiKey } = await billingService.createCustomer(companyName, email, tier);
    res.json({ success: true, data: { customer, apiKey } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/usage
 * Get current billing period usage and invoice preview.
 */
router.get('/usage', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey } = req.query;
    
    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ success: false, error: 'apiKey query parameter is required' });
      return;
    }

    const preview = billingService.getInvoicePreview(apiKey);
    
    if (!preview) {
      res.status(404).json({ success: false, error: 'Invalid API key or inactive customer' });
      return;
    }

    res.json({ success: true, data: preview });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/stats
 * Admin only: Get platform-wide revenue stats.
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic admin check (could use proper roles)
    if (req.user!.email !== 'admin@pabandi.com') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    const stats = billingService.getRevenueStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/pricing
 * Get available billing tiers and pricing.
 */
router.get('/pricing', (_req: Request, res: Response) => {
  res.json({ success: true, data: billingService.getTierPricing() });
});

export default router;
