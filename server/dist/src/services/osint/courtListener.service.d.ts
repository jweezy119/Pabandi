export interface CourtListenerSearchResult {
    count: number;
    results: Array<{
        id: number;
        caseName: string;
        docketNumber: string;
        court: string;
        dateFiled: string;
        natureOfSuit: string;
        status: string;
    }>;
}
export declare class CourtListenerService {
    private static CACHE_TTL_MS;
    private cache;
    private get apiKey();
    /**
     * Search for civil litigation involving a specific name (Landlord or Tenant)
     * We filter heavily by exact name and potentially jurisdiction to reduce false positives.
     */
    searchCivilLitigation(name: string, state?: string, requireExactMatch?: boolean): Promise<CourtListenerSearchResult>;
}
export declare const courtListenerService: CourtListenerService;
//# sourceMappingURL=courtListener.service.d.ts.map