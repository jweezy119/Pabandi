export type PmsProvider = 'beds24' | 'cloudbeds' | 'lodgify' | 'manual';
export type HospitalityBookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW' | 'MODIFIED';
export interface HospitalityBooking {
    /** Unique reservation ID from the PMS */
    pmsReservationId: string;
    /** Internal Pabandi property ID */
    propertyId: string;
    /** PMS provider name */
    provider: PmsProvider;
    /** Guest full name */
    guestName: string;
    /** Guest email */
    guestEmail?: string;
    /** Guest phone */
    guestPhone?: string;
    /** Check-in date (ISO) */
    checkIn: string;
    /** Check-out date (ISO) */
    checkOut: string;
    /** Number of nights */
    nights: number;
    /** Deposit amount in USD (or local currency) */
    depositAmount: number;
    /** Currency code */
    currency: string;
    /** Total booking value */
    totalAmount: number;
    /** Current booking status */
    status: HospitalityBookingStatus;
    /** Raw event from PMS */
    rawEvent?: Record<string, any>;
}
export interface ConnectedProperty {
    id: string;
    businessId: string;
    provider: PmsProvider;
    /** Beds24: propertyId; Cloudbeds: property_id */
    pmsPropertyId: string;
    /** Encrypted API key / token */
    apiKey: string;
    /** Webhook signing secret for verification */
    signingSecret: string;
    propertyName: string;
    propertyType: 'hotel' | 'guesthouse' | 'riad' | 'safari_camp' | 'experience' | 'vacation_rental' | 'other';
    address?: string;
    country?: string;
    isActive: boolean;
}
declare class HospitalityService {
    /**
     * Connect a hotel/lodge property to Pabandi by storing their PMS credentials
     * and registering our webhook endpoint with the PMS provider.
     */
    connectProperty(data: {
        businessId: string;
        provider: PmsProvider;
        pmsPropertyId: string;
        apiKey: string;
        propertyName: string;
        propertyType: ConnectedProperty['propertyType'];
        address?: string;
        country?: string;
    }): Promise<ConnectedProperty>;
    getPropertiesByBusiness(businessId: string): Promise<ConnectedProperty[]>;
    getPropertyById(id: string): Promise<ConnectedProperty | undefined>;
    getConnectionHealth(businessId: string): Promise<{
        hasConnections: boolean;
        totalProperties: number;
        activeProperties: number;
        providers: string[];
        lastSyncAt: string | null;
        tested: boolean;
        verifiedAt: string | null | undefined;
        eventCount: number;
        errorCount: number;
    }>;
    touchSync(propertyId: string, eventSuccess: boolean): void;
    checkAvailability(businessId: string, dateIso: string, partySize: number): Promise<{
        available: boolean;
        slots: never[];
        reason: "invalid_date";
        matchedTable?: undefined;
        bookedToday?: undefined;
    } | {
        available: boolean;
        slots: string[];
        reason: "available" | "fully_booked";
        matchedTable: {
            id: string;
            name: string;
            capacity: number;
        } | null;
        bookedToday: number;
    }>;
    /**
     * Process an incoming Beds24 v2 webhook (POST with full booking JSON body).
     * Beds24 sends all booking data in the body — no secondary API call needed.
     * Auth: X-Beds24-Auth token header.
     */
    processBeds24Webhook(rawBody: any, authToken: string): Promise<{
        action: string;
        booking: HospitalityBooking;
    } | null>;
    /**
     * Process an incoming Cloudbeds webhook.
     * Signed with HMAC-SHA256 — we verify the X-Cloudbeds-Webhook-Signature header.
     */
    processCloudbedsWebhook(rawBody: string, signature: string, propertyId: string): Promise<{
        action: string;
        booking: HospitalityBooking;
    } | null>;
    /**
     * Generic webhook processor for additional PMS integrations.
     * Supports HMAC verification when `signature` is provided.
     */
    processGenericWebhook(rawBody: string, signature: string, propertyId: string, expectedProvider: PmsProvider): Promise<{
        action: string;
        booking: HospitalityBooking;
    } | null>;
    /**
     * Handle a normalized hospitality booking event:
     * - CONFIRMED   → create escrow for deposit
     * - CHECKED_OUT → release escrow to property, mint $PAB to guest
     * - CANCELLED   → refund or forfeit based on policy window
     * - NO_SHOW     → forfeit no-show (80% property, 20% treasury)
     */
    handleBookingEvent(booking: HospitalityBooking, property: ConnectedProperty): Promise<void>;
    private onBookingConfirmed;
    private onCheckout;
    private onCancellation;
    private onNoShow;
    private normalizeBeds24Event;
    private normalizeCloudbedsEvent;
    private normalizeGenericEvent;
    private calcNights;
    private registerWebhookWithPms;
}
export declare const hospitalityService: HospitalityService;
export {};
//# sourceMappingURL=hospitalityService.d.ts.map