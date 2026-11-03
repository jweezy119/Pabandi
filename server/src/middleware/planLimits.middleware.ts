import { Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { AuthRequest } from './auth.middleware';

export function enforcePlanLimits(requiredFeature: 'api' | 'analytics' | 'clients' | 'users') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user?.businessId || (req as any).businessId;
      
      if (!businessId) {
        return res.status(402).json({
          success: false,
          error: 'Business context required',
          upgradeUrl: '/settings?tab=billing',
        });
      }

      // const result = await billingService.checkLimit(businessId, requiredFeature);
      
      // Stub: allow all requests until BillingService.checkLimit is implemented
      const result = { allowed: true, reason: null, upgradeUrl: null };
      
      if (!result.allowed) {
        return res.status(402).json({
          success: false,
          error: result.reason,
          upgradeUrl: result.upgradeUrl,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
