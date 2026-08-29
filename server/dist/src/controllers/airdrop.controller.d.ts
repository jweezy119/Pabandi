import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const getAirdropStats: (_req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getEligibility: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const claimAirdrop: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=airdrop.controller.d.ts.map