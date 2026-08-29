/**
 * Pabandi Yield Deposit (PYD) API — non-custodial rental security deposits.
 *
 * Pabandi is infrastructure only: records the trust-based deposit reduction,
 * facilitates the tenant+landlord yield-pool agreement, and orchestrates
 * non-custodial escrow settlement. Pabandi never holds principal.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { pydService, YieldPoolKey } from '../services/pyd.service';
import { prisma } from '../utils/database';

const router = Router();

/**
 * Create a security deposit (applies tenant's PTP band deposit reduction).
 * POST /api/v1/pyd/deposit
 */
router.post('/deposit', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const body = req.body ?? {};
    const { landlordId, depositContext, assetDescription, requiredAmountUSD, yieldOptIn, communityPoolOptIn, pool, beneficiaryBackgroundCheckId } = body;

    if (!landlordId || !assetDescription || !requiredAmountUSD) {
      return res.status(400).json({ success: false, error: 'landlordId, assetDescription, requiredAmountUSD required' });
    }

    const result = await pydService.createDeposit({
      tenantId: userId,
      landlordId,
      depositContext,
      assetDescription,
      requiredAmountUSD: Number(requiredAmountUSD),
      yieldOptIn,
      communityPoolOptIn,
      pool: pool as YieldPoolKey,
      beneficiaryBackgroundCheckId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Propose / view a yield agreement for a deposit.
 * POST /api/v1/pyd/deposit/:id/yield-agreement
 */
router.post('/deposit/:id/yield-agreement', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const { pool } = req.body ?? {};
    const agreement = await pydService.proposeYieldAgreement(
      req.params.id,
      userId,
      req.body.landlordId,
      (pool as YieldPoolKey) ?? 'JITO_STSOL'
    );
    res.json({ success: true, data: agreement });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Tenant signs the yield agreement.
 * POST /api/v1/pyd/yield-agreement/:id/sign-tenant
 */
router.post('/yield-agreement/:id/sign-tenant', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const ag = await pydService.signAsTenant(req.params.id, userId);
    res.json({ success: true, data: ag });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Landlord signs the yield agreement.
 * POST /api/v1/pyd/yield-agreement/:id/sign-landlord
 */
router.post('/yield-agreement/:id/sign-landlord', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const ag = await pydService.signAsLandlord(req.params.id, userId);
    res.json({ success: true, data: ag });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Fund the deposit into the non-custodial Solana escrow contract.
 * POST /api/v1/pyd/deposit/:id/fund
 */
router.post('/deposit/:id/fund', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { tenantWallet } = req.body ?? {};
    if (!tenantWallet) return res.status(400).json({ success: false, error: 'tenantWallet required' });
    const deposit = await pydService.fundEscrow(req.params.id, tenantWallet);
    res.json({ success: true, data: deposit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Projected yield for a deposit (dashboard).
 * GET /api/v1/pyd/deposit/:id/project-yield?months=12
 */
router.get('/deposit/:id/project-yield', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const months = Number(req.query.months) || 12;
    const projection = await pydService.projectYield(req.params.id, months);
    res.json({ success: true, data: projection });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get a deposit with its yield agreement.
 * GET /api/v1/pyd/deposit/:id
 */
router.get('/deposit/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const deposit = await pydService.getDeposit(req.params.id);
    res.json({ success: true, data: deposit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/pyd/rent-stream
 * Create a tokenized rent stream (rent held in yield rail for float window).
 */
router.post('/rent-stream', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = (req as any).user?.id;
    const { landlordId, rentAmountUSD, propertyId, pool, expectedApy, holdingDays } = req.body ?? {};
    if (!landlordId || !rentAmountUSD) {
      return res.status(400).json({ success: false, error: 'landlordId, rentAmountUSD required' });
    }
    const { renterEquityService } = await import('../services/renterEquity.service');
    const stream = await renterEquityService.createRentStream({
      tenantId,
      landlordId,
      rentAmountUSD: Number(rentAmountUSD),
      propertyId,
      pool,
      expectedApy: expectedApy ? Number(expectedApy) : undefined,
      holdingDays: holdingDays ? Number(holdingDays) : undefined,
    });
    res.json({ success: true, data: stream });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/pyd/renter-equity/:userId
 * View a user's renter equity wallet (yield accrued, no principal).
 */
router.get('/renter-equity/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { renterEquityService } = await import('../services/renterEquity.service');
    const equity = await renterEquityService.getEquity(req.params.userId);
    res.json({ success: true, data: equity });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/pyd/usdy/config
 * Public view of the Ondo USDY rail status (mint, live flag, APY) — no secrets.
 */
router.get('/usdy/config', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { ondoUsdyService } = await import('../services/ondoUsdy.service');
    res.json({
      success: true,
      data: {
        live: process.env.ONDO_RWA_LIVE === 'true',
        usdyMint: process.env.ONDO_USDY_MINT || null,
        settlementWalletConfigured: !!process.env.ONDO_SETTLEMENT_KEY,
        apy: Number(process.env.ONDO_APY || 4.5),
        note: process.env.ONDO_RWA_LIVE === 'true'
          ? 'Real on-chain USDY holding + yield distribution active (settlement wallet).'
          : 'SIMULATED: set ONDO_RWA_LIVE=true + ONDO_USDY_MINT + ONDO_SETTLEMENT_KEY to go live.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/pyd/usdy/hold
 * Hold a rent payment in USDY for the float window (real SPL transfer when live).
 */
router.post('/usdy/hold', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = (req as any).user?.id;
    const { streamId, tenantWallet, amountUsd } = req.body ?? {};
    if (!streamId || !tenantWallet || !amountUsd) {
      return res.status(400).json({ success: false, error: 'streamId, tenantWallet, amountUsd required' });
    }
    const { ondoUsdyService } = await import('../services/ondoUsdy.service');
    const result = await ondoUsdyService.holdInUsdy(streamId, tenantWallet, Number(amountUsd));
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

/**
 * POST /api/v1/pyd/migrate
 * Add new SecurityDeposit columns for generalized PPD rail (Cloud Run FS read-only → raw SQL).
 */
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const cols = [
      `ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "depositContext" TEXT NOT NULL DEFAULT 'PROPERTY'`,
      `ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "bcReductionPct" DOUBLE PRECISION NOT NULL DEFAULT 0`,
      `ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "bcCheckId" TEXT`,
      `ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "communityPoolOptIn" BOOLEAN NOT NULL DEFAULT false`,
    ];
    for (const c of cols) await prisma.$executeRawUnsafe(c);
    res.json({ success: true, message: 'SecurityDeposit columns migrated' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});
