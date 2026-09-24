import { Request, Response, NextFunction } from 'express';
/**
 * POST /api/v1/bookings/create-with-payment
 * Step 1: Create a pending reservation + Square checkout session
 * Returns: bookingRef, squareCheckoutUrl, depositAmount, rewardsPreview
 */
export declare const createWithPayment: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/bookings/confirm-payment
 * Square redirects here after successful payment.
 * Verifies payment, updates reservation to PAID, issues rewards, creates escrow.
 */
export declare const confirmPayment: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/bookings/checkin
 * Check-in: verifies reservation, triggers escrow release, deducts 2% fee
 */
export declare const checkin: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/bookings/status/:bookingRef
 * Poll booking status
 */
export declare const getBookingStatus: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=coreBooking.controller.d.ts.map