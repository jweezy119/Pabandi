import { Request, Response, NextFunction } from 'express';
export declare function checkAvailability(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function createReceptionistCheckout(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function receptionistAnalytics(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/hospitality/beds24/webhook
 * Receives Beds24 v2 booking events (full JSON body).
 * Auth: X-Beds24-Auth header must match connected property's API key.
 */
export declare function beds24Webhook(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/hospitality/cloudbeds/webhook?propertyId=hp_xxx
 * Receives Cloudbeds signed webhook events.
 * Auth: X-Cloudbeds-Webhook-Signature (HMAC-SHA256 of raw body).
 */
export declare function cloudbedsWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/hospitality/lodgify/webhook?propertyId=hp_xxx
 * Receives Lodgify REST API booking events.
 * Auth: X-Pabandi-Signature (HMAC-SHA256 of raw body using signing secret).
 */
export declare function lodgifyWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/hospitality/manual/webhook?propertyId=hp_xxx
 * Receives generic/custom PMS booking events.
 * Auth: X-Pabandi-Signature (HMAC-SHA256 of raw body using signing secret).
 */
export declare function manualWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/hospitality/connect
 * Connect a hotel/lodge PMS to Pabandi escrow reliability.
 */
export declare function connectProperty(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/hospitality/properties
 * List all properties connected to the authenticated business.
 */
export declare function listProperties(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/hospitality/property/:id
 * Get a single connected property's details.
 */
export declare function getProperty(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/hospitality/property/:id/availability
 * Return real slots from connected PMS. (A1)
 */
export declare function getPropertyAvailability(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/hospitality/test-booking
 * Simulate a test booking event for development/demo purposes.
 */
export declare function simulateBooking(_req: Request, res: Response): Promise<void>;
/**
 * GET /api/hospitality/health
 * Connection health/capability status for the current business,
 * reusing the existing in-memory property registry instead of dead demo paths.
 */
export declare function getConnectionHealth(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=hospitality.controller.d.ts.map