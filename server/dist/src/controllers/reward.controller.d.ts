import { Request, Response, NextFunction } from 'express';
export declare const getRewardBalance: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getRewardHistory: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getRewardTiers: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const calculateRewards: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getFeeOffset: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=reward.controller.d.ts.map