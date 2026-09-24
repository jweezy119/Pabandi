import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare function getAlertsHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function dismissAlertHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getClientStageHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=revenue.controller.d.ts.map