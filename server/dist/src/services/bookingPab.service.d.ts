export declare function createBookingWithPab(params: {
    bookingId: string;
    userId: string;
    bookingValue: number;
    businessId?: string;
}): Promise<any>;
export declare function checkinBooking(bookingId: string): Promise<any>;
export declare function handleNoShow(bookingId: string): Promise<any>;
export declare function cancelBooking(bookingId: string): Promise<any>;
export declare const bookingPabService: {
    createBookingWithPab: typeof createBookingWithPab;
    checkinBooking: typeof checkinBooking;
    handleNoShow: typeof handleNoShow;
    cancelBooking: typeof cancelBooking;
    DEPOSIT_RATE: number;
    REWARD_RATE: number;
};
//# sourceMappingURL=bookingPab.service.d.ts.map