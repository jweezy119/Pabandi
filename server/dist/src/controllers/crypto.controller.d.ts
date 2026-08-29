import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const getMyWallet: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getBusinessRewards: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getRewardRules: (_req: Request, res: Response) => Promise<void>;
export declare const getContractAddresses: (_req: Request, res: Response) => Promise<void>;
export declare const connectSolanaWallet: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requestSolanaTransfer: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * POST /api/v1/crypto/mint-badge
 * Mints a Soulbound NFT badge for the authenticated user's connected wallet.
 * Computes eligible tier from user's reservation history + reliability score.
 */
export declare const mintBadge: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const stakeTokens: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const unstakeTokens: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=crypto.controller.d.ts.map