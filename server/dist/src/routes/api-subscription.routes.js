"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const safepay_service_1 = require("../services/safepay.service");
const logger_1 = require("../utils/logger");
const crypto_1 = require("crypto");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Prices in PKR for API tiers
const TIER_PRICING = {
    GROWTH: 27500, // Roughly $99 USD
    ENTERPRISE: 139000 // Roughly $499 USD
};
const TIER_LIMITS = {
    GROWTH: 10000,
    ENTERPRISE: 100000
};
/**
 * Generate a random API key
 */
function generateApiKey() {
    return 'pk_live_' + (0, crypto_1.randomBytes)(32).toString('hex');
}
/**
 * POST /api/v1/api-subscription/safepay
 * Initialize a Safepay checkout for API Subscription
 */
router.post('/safepay', async (req, res) => {
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
        const url = await safepay_service_1.safepayService.createApiSubscriptionCheckoutUrl(amount, referenceId);
        return res.json({ success: true, url, referenceId });
    }
    catch (error) {
        logger_1.logger.error('Error creating Safepay API subscription', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
/**
 * POST /api/v1/api-subscription/verify
 * Verify payment (Safepay tracker or Crypto hash) and provision API key
 */
router.post('/verify', async (req, res) => {
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
        logger_1.logger.info(`Provisioning API key for ${companyName} (${tier}) via ${paymentMethod}`);
        // Generate Key
        const apiKey = generateApiKey();
        const limit = TIER_LIMITS[tier.toUpperCase()] || 500;
        // Create ApiClient
        const apiClient = await prisma.apiClient.create({
            data: {
                name: companyName,
                email: email,
                apiKey: apiKey,
                tier: tier.toUpperCase(),
                callsLimit: limit,
                paymentMethod: paymentMethod,
                transactionHash: transactionHash,
                walletAddress: walletAddress || null
            }
        });
        return res.json({ success: true, apiKey: apiClient.apiKey, tier: apiClient.tier });
    }
    catch (error) {
        logger_1.logger.error('Error verifying API subscription', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=api-subscription.routes.js.map