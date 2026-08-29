import { Request, Response } from 'express';
export declare const accountManagerController: {
    createPartner(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateConfig(req: Request, res: Response): Promise<void>;
    getMe(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getReferrals(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getLedger(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getPayouts(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=accountManager.controller.d.ts.map