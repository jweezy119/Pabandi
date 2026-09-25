/**
 * privy.routes.ts — Privy webhook and organization wallet endpoints
 *
 * Routes:
 *   POST /api/v1/privy/webhook   — Privy webhook receiver (no auth, signature verified)
 *   POST /api/v1/privy/onboard   — Create org wallet (auth: ADMIN)
 *   GET  /api/v1/privy/wallet/:id — Get wallet info (auth: ADMIN)
 *   POST /api/v1/privy/spons     — Sponsor gas (auth: ADMIN)
 */

import { logger } from '../utils/logger';

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import {
  createOrgWallet,
  verifyPrivyWebhook,
  sponsorGas,
  getWalletBalance,
} from '../services/privy.service';

const router = Router();

// All Privy admin routes require authentication
router.use('/onboard', authenticate);
router.use('/onboard', authorize('ADMIN'));
router.use('/wallet', authenticate);
router.use('/wallet', authorize('ADMIN'));
router.use('/spons', authenticate);
router.use('/spons', authorize('ADMIN'));

/**
 * POST /api/v1/privy/onboard
 * Create an organization wallet for a business.
 * Body: { organizationId, organizationName, chain? }
 */
router.post('/onboard', async (req: Request, res: Response) => {
  try {
    const { organizationId, organizationName, chain } = req.body;

    if (!organizationId || !organizationName) {
      return res.status(400).json({
        success: false,
        error: 'organizationId and organizationName are required',
      });
    }

    const wallet = await createOrgWallet({ organizationId, organizationName, chain });

    // Store the org wallet mapping in the Business record via raw query
    // (schema.prisma has privyWalletId field added, but Prisma client not regenerated)
    await prisma.$executeRaw`
      INSERT INTO Business (id, name, privyWalletId, category, address, city, country, currency, timezone, "isVerified", "isActive", "isPremium", "bookingAdvanceDays", "cancellationHours", "requireDeposit")
      VALUES (${organizationId}, ${organizationName}, ${wallet.id}, 'OTHER', 'N/A', 'N/A', 'United States', 'USD', 'America/New_York', true, true, false, 30, 24, false)
      ON CONFLICT (id) DO UPDATE SET "privyWalletId" = ${wallet.id}
    `;

    logger.info(`[Privy] Org wallet onboarded: ${wallet.address} for org ${organizationId}`);

    res.json({
      success: true,
      data: {
        walletId: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        status: wallet.status,
      },
    });
  } catch (err: any) {
    logger.error(`[Privy] Onboard error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/privy/wallet/:id
 * Get wallet info by organization ID.
 */
router.get('/wallet/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Look up via Business model using raw query (schema has privyWalletId, client not regenerated)
    const business = await prisma.$queryRaw<{ id: string; organizationName: string; privyWalletId: string; createdAt: Date }[]>`
      SELECT id, name as "organizationName", privyWalletId as "privyWalletId", created_at as "createdAt"
      FROM "Business" WHERE id = ${id}
    `;

    const org = business[0] as { id: string; organizationName: string; privyWalletId: string; createdAt: Date };
    if (!org || !org.privyWalletId) {
      return res.status(404).json({ success: false, error: 'Organization wallet not found' });
    }

    // Get live balance from Privy
    let balance;
    try {
      balance = await getWalletBalance(business.privyWalletId, 'solana');
    } catch {
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
  } catch (err: any) {
    logger.error(`[Privy] Wallet lookup error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/privy/spons
 * Sponsor gas for an organization wallet.
 * Body: { organizationId }
 */
router.post('/spons', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.body;

    const business = await prisma.$queryRaw<{ privyWalletId: string }[]>`SELECT "privyWalletId" FROM "Business" WHERE id = ${organizationId}`;
    const org = business[0] as { privyWalletId: string };

    if (!org || !org.privyWalletId) {
      return res.status(404).json({ success: false, error: 'Organization wallet not found' });
    }

    const result = await sponsorGas(org.privyWalletId, 'solana');

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    logger.error(`[Privy] Spons error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/privy/webhook
 * Privy webhook receiver — signature verified, then emits events.
 * No auth required (Privy signs the webhook).
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['privy-signature'] as string;
    const timestamp = req.headers['privy-timestamp'] as string;
    const body = Buffer.from(JSON.stringify(req.body));

    // Verify webhook signature
    const isValid = await verifyPrivyWebhook(body, signature, timestamp);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const event = req.body;
    logger.info(`[Privy] Webhook received: ${event.type} for org ${event.organization_id || event.org_id}`);

    // Handle different event types
    switch (event.type) {
      case 'wallet.created': {
        // Update Business record via raw query
        const walletId = event.data?.wallet?.id;
        const address = event.data?.wallet?.address;
        await prisma.$executeRaw`
          UPDATE "Business" SET "privyWalletId" = ${walletId}
          WHERE id = ${event.organization_id || event.org_id}
        `;
        logger.info(`[Privy] Wallet created: ${address}`);
        break;
      }
      case 'wallet.failed': {
        const walletId = event.data?.wallet?.id;
        await prisma.$executeRaw`
          UPDATE "Business" SET "privyWalletId" = NULL WHERE "privyWalletId" = ${walletId}
        `;
        logger.error(`[Privy] Wallet creation failed: ${walletId}`);
        break;
      }
      case 'transaction.confirmed': {
        // Emit trust events based on transaction type
        const txnType = event.data?.transaction?.type;
        logger.info(`[Privy] Transaction confirmed: ${txnType}`);
        // TODO: Emit trust events for invoice.paid_on_time, etc.
        break;
      }
      default:
        logger.info(`[Privy] Unhandled webhook event type: ${event.type}`);
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error(`[Privy] Webhook handler error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
