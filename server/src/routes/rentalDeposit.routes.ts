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

const router = Router();

/**
 * Create a security deposit (applies tenant's PTP band deposit reduction).
 * POST /api/v1/pyd/deposit
 */
router.post('/deposit', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const body = req.body ?? {};
    const { landlordId, rentalType, assetDescription, requiredAmountUSD, yieldOptIn, pool } = body;

    if (!landlordId || !assetDescription || !requiredAmountUSD) {
      return res.status(400).json({ success: false, error: 'landlordId, assetDescription, requiredAmountUSD required' });
    }

    const result = await pydService.createDeposit({
      tenantId: userId,
      landlordId,
      rentalType,
      assetDescription,
      requiredAmountUSD: Number(requiredAmountUSD),
      yieldOptIn,
      pool: pool as YieldPoolKey,
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

export default router;
