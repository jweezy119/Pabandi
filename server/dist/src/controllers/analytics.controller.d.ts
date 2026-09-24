import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const getAnalytics: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /analytics/detailed
 * Extended analytics for the dedicated analytics dashboard page.
 * Includes time-series data, deposit breakdowns, and top customers.
 */
export declare const getDetailedAnalytics: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=analytics.controller.d.ts.map