export type PopEventType = 'INTENT' | 'ARRIVED' | 'NO_SHOW' | 'MERCHANT_START' | 'MERCHANT_FULFILL';
export interface PopEventInput {
    userId: string;
    businessId?: string;
    reservationId?: string;
    eventType: PopEventType;
    source: 'buyer' | 'merchant' | 'system';
    meta?: Record<string, any>;
}
export interface PopDisputePackage {
    reservationId?: string;
    buyerIntentAt?: string;
    merchantStartAt?: string;
    merchantFulfillAt?: string;
    noShowAt?: string;
    evidence: Record<string, any>;
}
export declare class PopService {
    private events;
    recordEvent(input: PopEventInput): Promise<PopEventInput & {
        createdAt: string;
    }>;
    getEventsForReservation(reservationId: string): Promise<PopEventInput[]>;
    private attachDisputePackage;
}
export declare const popService: PopService;
//# sourceMappingURL=pop.service.d.ts.map