export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';
export interface CourtCheckResult {
    id?: string;
    subjectType: 'TENANT' | 'LANDLORD';
    name: string;
    state?: string;
    found: boolean;
    count: number;
    recentEviction: boolean;
    riskBand: RiskBand;
    reductionPct: number;
    cases: any[];
}
/**
 * Run a CourtListener eviction/litigation screen, persist the result to CourtCheck,
 * and return the structured finding. Safe to call fire-and-forget from booking flows.
 */
export declare function screenParty(params: {
    subjectType: 'TENANT' | 'LANDLORD';
    name: string;
    state?: string;
    reservationId?: string;
    businessId?: string;
    customerId?: string;
}): Promise<CourtCheckResult>;
/**
 * Screen both parties of a reservation and return their bands + a combined
 * deposit adjustment suggestion. Fire-and-forget safe.
 */
export declare function screenReservation(reservationId: string): Promise<{
    tenant?: CourtCheckResult;
    landlord?: CourtCheckResult;
}>;
export declare const courtCheckService: {
    screenParty: typeof screenParty;
    screenReservation: typeof screenReservation;
    BAND_REDUCTION: Record<RiskBand, number>;
};
//# sourceMappingURL=courtCheck.service.d.ts.map