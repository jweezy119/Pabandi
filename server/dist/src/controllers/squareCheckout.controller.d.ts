import { Request, Response, NextFunction } from 'express';
export declare const createSquareCheckout: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getSquarePayment: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const handleSquareWebhook: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createSquareRefund: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=squareCheckout.controller.d.ts.map