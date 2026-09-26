import { Request, Response } from 'express';
/**
 * POST /api/v1/marketplace/audience
 * Brand submits criteria → gets back ONLY a count and a Merkle Root hash.
 * They learn nothing about who is in the set.
 */
export declare const getAudiencePreview: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/marketplace/campaign
 * Brand funds a campaign → we build the Merkle Tree and notify users with their proofs.
 */
export declare const createAndExecuteCampaign: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/marketplace/claim
 * User submits walletAddress + Merkle Proof → verified against the root → paid.
 * No database lookup. Pure cryptographic verification.
 */
export declare const claimReward: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=marketplace.controller.d.ts.map