import { Request, Response } from 'express';
/**
 * Get a cryptographically signed attestation of a user's Trust Score.
 * This can be submitted to Solana smart contracts for on-chain verification.
 */
export declare const getTrustScoreAttestation: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=oracle.controller.d.ts.map