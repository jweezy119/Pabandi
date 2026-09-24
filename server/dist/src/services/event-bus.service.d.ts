export type TrustEventType = 'score.changed' | 'escrow.funded' | 'escrow.released' | 'escrow.disputed' | 'checkin.verified' | 'passport.linked';
export interface TrustEvent {
    type: TrustEventType;
    passportId?: string;
    jobId?: string;
    clientId?: string;
    businessId?: string;
    data: Record<string, any>;
    timestamp: Date;
}
type EventHandler = (event: TrustEvent) => void;
declare class EventBus {
    private handlers;
    subscribe(type: string, handler: EventHandler): () => void;
    publish(event: TrustEvent): void;
    emitEvent(type: string, data: Record<string, any>): void;
}
export declare const eventBus: EventBus;
export {};
//# sourceMappingURL=event-bus.service.d.ts.map