import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
/**
 * GET /api/v1/mudarabah/pools
 * List all OPEN/ACTIVE pools with business info and new fields.
 */
export declare const getAllPools: (_req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/v1/mudarabah/pools/featured
 * List featured pools publicly.
 */
export declare const getFeaturedPools: (_req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/v1/mudarabah/pools/:id
 * Pool detail with investments count and all new fields.
 */
export declare const getPoolById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/v1/mudarabah/transparency/:id
 * Public Sharia transparency data — shows the math, no-riba proof.
 */
export declare const getTransparencyData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/v1/mudarabah/pools/validate
 * Public pre-validation endpoint — validates pool data without saving.
 */
export declare const validatePool: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/v1/mudarabah/pools
 * Create a new Mudarabah pool (business owner only).
 * Accepts and validates all new wizard fields.
 */
export declare const createPool: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * PATCH /api/v1/mudarabah/pools/:id
 * Update own pool — now supports all new fields.
 */
export declare const updatePool: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/v1/mudarabah/pools/:id/validate
 * Pre-validate pool data for an existing pool before submission.
 */
export declare const validateExistingPool: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * DELETE /api/v1/mudarabah/pools/:id
 * Close own pool.
 */
export declare const closePool: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/v1/mudarabah/my-pools
 * List authenticated business owner's pools.
 */
export declare const getMyPools: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/v1/mudarabah/pools/:id/invest
 * Invest in a Mudarabah pool.
 */
export declare const investInPool: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/v1/mudarabah/pools/:id/withdraw
 * Withdraw investment (marks as WITHDRAWN, returns capital).
 */
export declare const withdrawInvestment: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/v1/mudarabah/my-investments
 * List authenticated user's investments with profit totals.
 */
export declare const getMyInvestments: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/v1/mudarabah/pools/:id/distribute
 * Calculate and distribute profits (business owner).
 * Body: { totalRevenue: number, periodStart: ISO date, periodEnd: ISO date }
 */
export declare const distributeProfits: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/v1/mudarabah/pools/:id/distributions
 * List distributions for a pool (business owner only).
 */
export declare const getPoolDistributions: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/v1/mudarabah/pools/:id/investments
 * Public: list investments for a pool (anonymized, for pool detail page).
 */
export declare const getPoolInvestments: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/v1/mudarabah/pools/:id/distributions/public
 * Public: distribution history for a pool (for pool detail page).
 */
export declare const getPoolDistributionsPublic: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=mudarabah.controller.d.ts.map