import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const getRecommendations: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getRecommendedInvestors: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const upsertProfile: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getProfile: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getInsights: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const recordFeedback: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getStats: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const batchGenerateMatches: (_req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=mudarabahMatcher.controller.d.ts.map