import { Request, Response, NextFunction } from 'express';
export interface ApiKeyRequest extends Request {
    apiClient?: {
        id: string;
        name: string;
        email: string;
        tier: string;
        callsUsed: number;
        callsLimit: number;
        businessId: string | null;
    };
    requestStartTime?: number;
}
/**
 * Validates the x-api-key header, enforces quota, and attaches
 * the resolved ApiClient to req.apiClient.
 */
export declare const apiKeyAuth: (req: ApiKeyRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Records the API call in ApiUsageLog and increments callsUsed.
 * Must be used AFTER the response is sent (via res.on('finish')).
 */
export declare const logApiUsage: (req: ApiKeyRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=apiKey.middleware.d.ts.map