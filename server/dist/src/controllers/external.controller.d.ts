import { Request, Response, NextFunction } from 'express';
import { ApiKeyRequest } from '../middleware/apiKey.middleware';
export declare const getReliabilityScore: (req: ApiKeyRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPartnerTrustBadge: (req: ApiKeyRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const reportTransactionOutcome: (req: ApiKeyRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getUsage: (req: ApiKeyRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const channexWebhook: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=external.controller.d.ts.map