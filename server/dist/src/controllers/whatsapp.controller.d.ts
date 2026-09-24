import { Request, Response } from 'express';
/**
 * Webhook Verification for Meta WhatsApp API (GET request)
 */
export declare const verifyWebhook: (req: Request, res: Response) => void;
/**
 * Webhook to receive incoming messages from Meta WhatsApp API (POST request)
 */
export declare const handleIncomingWhatsApp: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=whatsapp.controller.d.ts.map