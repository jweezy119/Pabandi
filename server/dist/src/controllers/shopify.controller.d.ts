import { Request, Response } from 'express';
export declare const shopifyAuth: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const shopifyAuthCallback: (req: Request, res: Response) => Promise<void>;
export declare const connectShopifyStore: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const shopifyWebhooks: (req: Request, res: Response) => Promise<void>;
export declare const createVerificationSession: (req: Request, res: Response) => Promise<void>;
export declare const verificationCallback: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=shopify.controller.d.ts.map