import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const createPaymentRequest: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPaymentById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const verifyPayment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const processBTCPayWebhook: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createEscrow: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const releaseEscrow: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const refundEscrow: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getEscrowById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPaymentStatus: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createPayLio: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPayLioPaymentStatus: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const processPayLioWebhook: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=payment.controller.d.ts.map