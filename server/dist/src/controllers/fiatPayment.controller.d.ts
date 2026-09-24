import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const createFiatPaymentRequest: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getFiatPaymentStatusController: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const confirmFiatPaymentController: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const rejectFiatPaymentController: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const cancelFiatPaymentController: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const markFiatPaymentSentController: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getFiatMethods: (_req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const listPendingFiatPaymentsController: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=fiatPayment.controller.d.ts.map