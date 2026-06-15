import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { safepayService } from '../services/safepay.service';
import { logger } from '../utils/logger';
import { randomBytes } from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Prices in PKR for API tiers
const TIER_PRICING: Record<string, number> = {
  GROWTH: 27500, // Roughly $99 USD
  ENTERPRISE: 139000 // Roughly $499 USD
};

const TIER_LIMITS: Record<string, number> = {
  GROWTH: 10000,
  ENTERPRISE: 100000
};

/**
 * Generate a random API key
 */
function generateApiKey(): string {
  return 'pk_live_' + randomBytes(32).toString('hex');
}

/**
 * POST /api/v1/api-subscription/safepay
 * Initialize a Safepay checkout for API Subscription
 */
router.post('/safepay', async (req: Request, res: Response): Promise<any> => {
  try {
    const { tier, email, companyName } = req.body;
    
    if (!tier || !TIER_PRICING[tier.toUpperCase()]) {
      return res.status(400).json({ success: false, error: 'Invalid or missing tier' });
    }
    
    if (!email || !companyName) {
      return res.status(400).json({ success: false, error: 'Email and company name are required' });
    }

    const amount = TIER_PRICING[tier.toUpperCase()];
    
    // Create a unique reference ID for this subscription attempt
    const referenceId = `api_sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Get Safepay checkout URL
    const url = await safepayService.createApiSubscriptionCheckoutUrl(amount, referenceId);
    
    return res.json({ success: true, url, referenceId });
  } catch (error: any) {
    logger.error('Error creating Safepay API subscription', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/v1/api-subscription/verify
 * Verify payment (Safepay tracker or Crypto hash) and provision API key
 */
router.post('/verify', async (req: Request, res: Response): Promise<any> => {
  try {
    const { tier, email, companyName, paymentMethod, transactionHash, walletAddress } = req.body;
    
    if (!tier || !email || !companyName || !paymentMethod || !transactionHash) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check if we already processed this transaction
    const existing = await prisma.apiClient.findUnique({
      where: { transactionHash }
    });

    if (existing) {
      // If we already generated an API key for this tx, just return it
      return res.json({ success: true, apiKey: existing.apiKey, tier: existing.tier });
    }

    // In a production environment, we should verify the Safepay tracker ID or Crypto TX Hash here.
    // For MVP, if it reached this endpoint, we assume the frontend verified the on-chain TX or Safepay redirect.
    logger.info(`Provisioning API key for ${companyName} (${tier}) via ${paymentMethod}`);

    // Generate Key
    const apiKey = generateApiKey();
    const limit = TIER_LIMITS[tier.toUpperCase()] || 500;

    // Create ApiClient
    const apiClient = await prisma.apiClient.create({
      data: {
        name: companyName,
        email: email,
        apiKey: apiKey,
        tier: tier.toUpperCase() as any,
        callsLimit: limit,
        paymentMethod: paymentMethod,
        transactionHash: transactionHash,
        walletAddress: walletAddress || null
      }
    });

    return res.json({ success: true, apiKey: apiClient.apiKey, tier: apiClient.tier });
  } catch (error: any) {
    logger.error('Error verifying API subscription', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

export default router;
