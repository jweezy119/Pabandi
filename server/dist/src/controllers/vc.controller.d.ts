import { Request, Response } from 'express';
export declare const getDidDocument: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const issueCredential: (req: Request, res: Response) => Promise<void>;
export declare const listCredentials: (req: Request, res: Response) => Promise<void>;
export declare const revokeCredential: (req: Request, res: Response) => Promise<void>;
export declare const verifyCredential: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getStatusList: (req: Request, res: Response) => Promise<void>;
export declare const createPresentation: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=vc.controller.d.ts.map