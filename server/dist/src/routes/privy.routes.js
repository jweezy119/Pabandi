"use strict";
/**
 * privy.routes.ts — Privy webhook and organization wallet endpoints
 *
 * Routes:
 *   POST /api/v1/privy/webhook   — Privy webhook receiver (no auth, signature verified)
 *   POST /api/v1/privy/onboard   — Create org wallet (auth: ADMIN)
 *   GET  /api/v1/privy/wallet/:id — Get wallet info (auth: ADMIN)
 *   POST /api/v1/privy/spons     — Sponsor gas (auth: ADMIN)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const privy_service_1 = require("../services/privy.service");
const router = (0, express_1.Router)();
// All Privy admin routes require authentication
router.use('/onboard', auth_middleware_1.authenticate);
router.use('/onboard', (0, auth_middleware_1.authorize)('ADMIN'));
router.use('/wallet', auth_middleware_1.authenticate);
router.use('/wallet', (0, auth_middleware_1.authorize)('ADMIN'));
router.use('/spons', auth_middleware_1.authenticate);
router.use('/spons', (0, auth_middleware_1.authorize)('ADMIN'));
/**
 * POST /api/v1/privy/onboard
 * Create an organization wallet for a business.
 * Body: { organizationId, organizationName, chain? }
 */
router.post('/onboard', async (req, res) => {
    try {
        const { organizationId, organizationName, chain } = req.body;
        if (!organizationId || !organizationName) {
            return res.status(400).json({
                success: false,
                error: 'organizationId and organizationName are required',
            });
        }
        const wallet = await (0, privy_service_1.createOrgWallet)({ organizationId, organizationName, chain });
        // Store the org wallet mapping in the Business record via raw query
        // (schema.prisma has privyWalletId field added, but Prisma client not regenerated)
        await database_1.prisma.$executeRaw `
      INSERT INTO Business (id, name, privyWalletId, category, address, city, country, currency, timezone, "isVerified", "isActive", "isPremium", "bookingAdvanceDays", "cancellationHours", "requireDeposit")
      VALUES (${organizationId}, ${organizationName}, ${wallet.id}, 'OTHER', 'N/A', 'N/A', 'United States', 'USD', 'America/New_York', true, true, false, 30, 24, false)
      ON CONFLICT (id) DO UPDATE SET "privyWalletId" = ${wallet.id}
    `;
        logger_1.logger.info(`[Privy] Org wallet onboarded: ${wallet.address} for org ${organizationId}`);
        res.json({
            success: true,
            data: {
                walletId: wallet.id,
                address: wallet.address,
                chain: wallet.chain,
                status: wallet.status,
            },
        });
    }
    catch (err) {
        logger_1.logger.error(`[Privy] Onboard error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/privy/wallet/:id
 * Get wallet info by organization ID.
 */
router.get('/wallet/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Look up via Business model using raw query (schema has privyWalletId, client not regenerated)
        const business = await database_1.prisma.$queryRaw `
      SELECT id, name as "organizationName", privyWalletId as "privyWalletId", created_at as "createdAt"
      FROM "Business" WHERE id = ${id}
    `;
        const org = business[0];
        if (!org || !org.privyWalletId) {
            return res.status(404).json({ success: false, error: 'Organization wallet not found' });
        }
        // Get live balance from Privy
        let balance;
        try {
            balance = await (0, privy_service_1.getWalletBalance)(business.privyWalletId, 'solana');
        }
        catch {
            balance = { balance: '0', unit: 'SOL' };
        }
        res.json({
            success: true,
            data: {
                organizationId: business.id,
                organizationName: business.organizationName,
                address: business.privyWalletId,
                chain: 'solana',
                status: 'active',
                balance,
                createdAt: business.createdAt,
            },
        });
    }
    catch (err) {
        logger_1.logger.error(`[Privy] Wallet lookup error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/privy/spons
 * Sponsor gas for an organization wallet.
 * Body: { organizationId }
 */
router.post('/spons', async (req, res) => {
    try {
        const { organizationId } = req.body;
        const business = await database_1.prisma.$queryRaw `SELECT "privyWalletId" FROM "Business" WHERE id = ${organizationId}`;
        const org = business[0];
        if (!org || !org.privyWalletId) {
            return res.status(404).json({ success: false, error: 'Organization wallet not found' });
        }
        const result = await (0, privy_service_1.sponsorGas)(org.privyWalletId, 'solana');
        res.json({
            success: true,
            data: result,
        });
    }
    catch (err) {
        logger_1.logger.error(`[Privy] Spons error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/privy/webhook
 * Privy webhook receiver — signature verified, then emits events.
 * No auth required (Privy signs the webhook).
 */
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['privy-signature'];
        const timestamp = req.headers['privy-timestamp'];
        const body = Buffer.from(JSON.stringify(req.body));
        // Verify webhook signature
        const isValid = await (0, privy_service_1.verifyPrivyWebhook)(body, signature, timestamp);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
        }
        const event = req.body;
        logger_1.logger.info(`[Privy] Webhook received: ${event.type} for org ${event.organization_id || event.org_id}`);
        // Handle different event types
        switch (event.type) {
            case 'wallet.created': {
                // Update Business record via raw query
                const walletId = event.data?.wallet?.id;
                const address = event.data?.wallet?.address;
                await database_1.prisma.$executeRaw `
          UPDATE "Business" SET "privyWalletId" = ${walletId}
          WHERE id = ${event.organization_id || event.org_id}
        `;
                logger_1.logger.info(`[Privy] Wallet created: ${address}`);
                break;
            }
            case 'wallet.failed': {
                const walletId = event.data?.wallet?.id;
                await database_1.prisma.$executeRaw `
          UPDATE "Business" SET "privyWalletId" = NULL WHERE "privyWalletId" = ${walletId}
        `;
                logger_1.logger.error(`[Privy] Wallet creation failed: ${walletId}`);
                break;
            }
            case 'transaction.confirmed': {
                // Emit trust events based on transaction type
                const txnType = event.data?.transaction?.type;
                logger_1.logger.info(`[Privy] Transaction confirmed: ${txnType}`);
                // TODO: Emit trust events for invoice.paid_on_time, etc.
                break;
            }
            default:
                logger_1.logger.info(`[Privy] Unhandled webhook event type: ${event.type}`);
        }
        res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error(`[Privy] Webhook handler error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=privy.routes.js.map