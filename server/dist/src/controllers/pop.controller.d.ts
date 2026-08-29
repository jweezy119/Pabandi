import { Request, Response, NextFunction } from 'express';
export declare const recordPopIntent: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const recordPopArrived: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const recordPopNoShow: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const recordMerchantStart: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const recordMerchantFulfill: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPopEventsForReservation: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=pop.controller.d.ts.map