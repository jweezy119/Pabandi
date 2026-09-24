export interface CourtListenerCase {
    id: number;
    caseName: string;
    docketNumber: string;
    court: string;
    courtType?: string;
    dateFiled: string;
    dateTerminated?: string;
    natureOfSuit: string;
    status: string;
    jurisdiction?: string;
    cause?: string;
    chapter?: string;
    party?: string[];
    attorney?: string[];
}
export interface CourtListenerSearchResult {
    count: number;
    totalPages: number;
    results: CourtListenerCase[];
}
export interface CourtCheckResult {
    criminalFound: boolean;
    criminalCount: number;
    recentCriminal: boolean;
    felonyCount: number;
    violentCrime: boolean;
    financialCrime: boolean;
    drugOffense: boolean;
    sexOffense: boolean;
    dui: boolean;
    evictionFound: boolean;
    evictionCount: number;
    recentEviction: boolean;
    civilCases: number;
    bankruptcyFound: boolean;
    bankruptcyCount: number;
    totalCases: number;
    riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
    riskFactors: string[];
    cases: CourtListenerCase[];
}
export interface CourtListenerSearchParams {
    q: string;
    name?: string;
    court?: string;
    jurisdiction?: string;
    type?: string;
    nature_of_suit?: string;
    cause?: string;
    docket_number?: string;
    date_filed_after?: string;
    date_filed_before?: string;
    date_terminated_after?: string;
    date_terminated_before?: string;
    party_name?: string;
    attorney_name?: string;
    page?: number;
    page_size?: number;
    order_by?: string;
    status?: string;
    demand?: string;
    jury_demand?: string;
    bankruptcy_information?: boolean;
}
export declare class CourtListenerService {
    private static CACHE_TTL_MS;
    private cache;
    private get apiKey();
    /**
     * Advanced search with all CourtListener API parameters.
     * Supports: court ID, jurisdiction, nature of suit, cause of action,
     * date ranges, docket number, party name, attorney name, etc.
     */
    search(params: CourtListenerSearchParams): Promise<CourtListenerSearchResult>;
    /**
     * Infer the type of case based on court name, nature of suit, and cause.
     */
    private inferCourtType;
    /**
     * Generate common name variations for better matching.
     * Handles: nicknames, middle initials, spelling variations, etc.
     */
    private generateNameVariations;
    /**
     * Comprehensive court check — criminal + civil + eviction.
     * Returns a unified risk verdict the trust engine can penalize on.
     */
    comprehensiveCheck(name: string, options?: {
        state?: string;
        court?: string;
        dateFiledAfter?: string;
        dateFiledBefore?: string;
        docketNumber?: string;
    }): Promise<CourtCheckResult>;
    /**
     * Legacy: Targeted eviction / housing-litigation lookup (kept for backward compat).
     */
    lookupEvictions(name: string, state?: string): Promise<{
        found: boolean;
        count: number;
        recentEviction: boolean;
        cases: CourtListenerCase[];
    }>;
}
export declare const courtListenerService: CourtListenerService;
//# sourceMappingURL=courtListener.service.d.ts.map