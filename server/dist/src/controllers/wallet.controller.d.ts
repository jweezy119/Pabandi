import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const getBalances: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const exportSecret: (req: AuthRequest, res: Response, next: import("express").NextFunction) => Promise<void>;
//# sourceMappingURL=wallet.controller.d.ts.map