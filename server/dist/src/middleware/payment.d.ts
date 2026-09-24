import { Request, Response, NextFunction } from 'express';
/**
 * x402 Payment Middleware
 * Returns HTTP 402 with price info if no payment proof provided
 */
export declare function x402Middleware(priceUsdc: number, description?: string): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * AP2 Authorization Middleware
 * Verifies three signed mandates for high-value transactions
 */
export declare function ap2Middleware(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=payment.d.ts.map