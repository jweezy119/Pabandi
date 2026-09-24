import { Request, Response, NextFunction } from 'express';
export declare const registerAgent: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const postProject: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const placeBid: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const acceptBid: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const completeProject: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const returnToBidding: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getMarketplaceStats: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getLeaderboard: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getOpenProjects: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getAgentProfile: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=agentMarketplace.controller.d.ts.map