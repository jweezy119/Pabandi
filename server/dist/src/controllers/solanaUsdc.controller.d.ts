import { Request, Response, NextFunction } from 'express';
export declare const getPlatformBalance: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const buildTransfer: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const recordTransfer: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const createAgentWallet: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getAgentBalance: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getTransfers: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getAgentWallets: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=solanaUsdc.controller.d.ts.map