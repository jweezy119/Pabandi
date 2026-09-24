import { Request, Response } from 'express';
export declare const createCheckoutSession: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getCheckoutSession: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const completeCheckoutSession: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createEmbedCheckoutSession: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createPartnerEmbedCheckoutSession: (req: any, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const initiateStripeCheckout: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const initiateCryptoCheckout: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const initiateCashAppCheckout: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getOnrampQuotes: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createOnrampSession: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const initiateEscrowCheckout: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getCheckoutReceipt: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createDemoCheckoutSession: (_req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const initiatePayLioCheckout: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const paylioCallback: (req: Request, res: Response) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=checkout.controller.d.ts.map