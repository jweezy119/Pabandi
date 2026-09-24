import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export interface BookingWithAP2 {
    businessId: string;
    customerId: string;
    reservationDate: string;
    reservationTime: string;
    numberOfGuests: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    depositAmount: number;
    specialRequests?: string;
    paymentMethod?: string;
    intentMandate?: any;
    cartMandate?: any;
    paymentMandate?: any;
}
/**
 * POST /api/v1/booking/create
 * Create a reservation + deposit payment (PayLio checkout URL returned)
 */
export declare const createBooking: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/booking/confirm
 * Confirm payment for a booking (polling endpoint)
 */
export declare const confirmBookingPayment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/booking/:reference/status
 * Get booking status (for polling)
 */
export declare const getBookingStatus: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/booking/escrow/release
 * Release escrow to business (after check-in)
 */
export declare const releaseBookingEscrow: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=booking.controller.d.ts.map