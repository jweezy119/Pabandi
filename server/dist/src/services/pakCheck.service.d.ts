export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';
declare function mapBackgroundBandToRisk(band?: string | null): RiskBand;
export interface PakCheckResult {
    subjectType: 'TENANT' | 'LANDLORD';
    name: string;
    source: 'PK_BACKGROUND' | 'PK_FBR' | 'NONE';
    available: boolean;
    found: boolean;
    count: number;
    recentEviction: boolean;
    riskBand: RiskBand;
    reductionPct: number;
    note?: string;
    cases: any[];
    manualVerifyUrl?: string;
}
/**
 * Pakistan trust screening. There is NO free, structured, machine-readable Pakistan
 * court-records API (CourtListener is US-only; SECP is unreachable; the Supreme Court
 * endpoint blocks bots). The genuine, already-built PK signal is the BackgroundCheck
 * (KYC / OSINT / sanctions / registry). We read the latest one for the subject.
 *
 * If an NTN is supplied we attempt FBR verification; on any failure we return
 * `available:false` with a manualVerifyUrl — we NEVER fabricate a result.
 */
export declare function screenPakParty(params: {
    subjectType: 'TENANT' | 'LANDLORD';
    subjectId?: string;
    name: string;
    ntn?: string;
    reservationId?: string;
    businessId?: string;
    customerId?: string;
}): Promise<PakCheckResult>;
export declare const pakCheckService: {
    screenPakParty: typeof screenPakParty;
    mapBackgroundBandToRisk: typeof mapBackgroundBandToRisk;
};
export {};
//# sourceMappingURL=pakCheck.service.d.ts.map