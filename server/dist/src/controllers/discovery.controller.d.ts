import { Response } from 'express';
import { ApiKeyRequest } from '../middleware/apiKey.middleware';
/**
 * POST /api/v1/network/discover
 *
 * Natural-Language Discovery API (GB/Z 185.5 Compliance)
 * Takes a natural language query and returns matching businesses.
 */
export declare const discoverAgents: (req: ApiKeyRequest, res: Response) => Promise<any>;
//# sourceMappingURL=discovery.controller.d.ts.map