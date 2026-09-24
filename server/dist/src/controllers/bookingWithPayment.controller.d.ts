import { Request, Response, NextFunction } from 'express';
export declare const createBookingWithPayment: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const confirmPaymentAndIssueRewards: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const checkInAndReleaseEscrow: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=bookingWithPayment.controller.d.ts.map