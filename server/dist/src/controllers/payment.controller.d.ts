import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const createPayment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPayment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createSubscriptionCheckout: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const processPaymentWebhook: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=payment.controller.d.ts.map