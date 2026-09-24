import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const createWebhook: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getWebhooks: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateWebhook: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteWebhook: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const regenerateSecret: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=webhook.controller.d.ts.map