import { Request, Response } from 'express';
export declare function getIntegrations(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getShowState(req: Request, res: Response): Promise<void>;
export declare function patchShowState(req: Request, res: Response): Promise<void>;
export declare function addOrder(req: Request, res: Response): Promise<void>;
export declare function importEbay(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function dropWhatsApp(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=livesell.controller.d.ts.map