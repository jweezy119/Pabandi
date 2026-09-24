export declare const channexService: {
    /**
     * Provision a property on Channex when a Host enables Channel Manager
     */
    provisionProperty(businessId: string): Promise<string>;
    /**
     * Push a reservation from Pabandi to Channex to block calendar on Airbnb
     */
    pushBooking(reservationId: string): Promise<void>;
    /**
     * Cancel a booking on Channex
     */
    cancelBooking(reservationId: string): Promise<void>;
};
//# sourceMappingURL=channex.service.d.ts.map