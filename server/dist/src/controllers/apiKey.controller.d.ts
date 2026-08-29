import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const generateApiKey: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getApiKeys: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=apiKey.controller.d.ts.map