/**
 * Solana Escrow Controller
 * ─────────────────────────────────────────────
 * Handles all on-chain escrow operations: create, fund, release,
 * refund, and dispute. Records every on-chain transaction in the
 * database for audit purposes.
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const createEscrow: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const fundEscrow: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const releaseEscrow: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const refundEscrow: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const raiseDispute: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getEscrow: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const listEscrows: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=solanaEscrow.controller.d.ts.map