export declare const checkInService: {
    generateCheckInToken(reservationId: string): Promise<{
        success: boolean;
        message: string;
        code?: undefined;
        expiresAt?: undefined;
        businessName?: undefined;
        reservationTime?: undefined;
        numberOfGuests?: undefined;
    } | {
        success: boolean;
        code: string;
        expiresAt: Date;
        businessName: string;
        reservationTime: string;
        numberOfGuests: number;
        message?: undefined;
    }>;
    /**
     * Verify check-in and auto-release escrow if deposit was held.
     */
    verifyCheckIn(data: {
        code: string;
        reservationId?: string;
        lat?: number;
        lng?: number;
        method: "qr" | "manual" | "location" | "nfc";
        verifiedBy?: string;
    }): Promise<{
        success: boolean;
        message: string;
        reservation?: undefined;
        locationVerified?: undefined;
        escrowReleased?: undefined;
        escrowDetails?: undefined;
        verifiedAt?: undefined;
    } | {
        success: boolean;
        message: string;
        reservation: {
            id: string;
            customerName: string;
            reservationTime: string;
            numberOfGuests: number;
        };
        locationVerified: boolean;
        escrowReleased: boolean;
        escrowDetails: {
            netToBusiness: any;
            releaseFee: any;
        } | null;
        verifiedAt: Date;
    }>;
    checkOut(reservationId: string): Promise<{
        success: boolean;
        message: string;
        duration?: undefined;
    } | {
        success: boolean;
        message: string;
        duration: number;
    }>;
    getCheckInHistory(reservationId: string): Promise<{
        success: boolean;
        message: string;
        checkIn?: undefined;
    } | {
        success: boolean;
        checkIn: {
            id: string;
            status: import(".prisma/client").$Enums.ReservationStatus;
            reservationDate: Date;
            checkInDate: Date | null;
            checkOutDate: Date | null;
            reservationTime: string;
            numberOfGuests: number;
            customerName: string;
            checkInLat: number | null;
            checkInLng: number | null;
            checkInMethod: string | null;
        };
        message?: undefined;
    }>;
    getActiveCheckIns(businessId: string): Promise<{
        success: boolean;
        activeCheckIns: {
            id: any;
            customerName: any;
            customerPhone: any;
            numberOfGuests: any;
            checkInTime: any;
            checkInMethod: any;
        }[];
        count: number;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
        activeCheckIns?: undefined;
        count?: undefined;
    }>;
};
//# sourceMappingURL=checkin.service.d.ts.map