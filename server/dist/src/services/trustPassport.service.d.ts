/**
 * trustPassport.service.ts — Pabandi Trust Passport (north-star: portable trust)
 *
 * Aggregates a provider's trust across all rails into one public, shareable
 * payload keyed by handle:
 *   - Web3Agent trust band / velocity / reliability (the headline)
 *   - Latest BackgroundCheck (verified identity, score, band, timestamp)
 *   - Active protected deposits + performance bonds (skin in the game)
 *   - HOA community pools governed (if applicable)
 *
 * The passport is the flywheel: providers build it (cheaper deposits/bonds),
 * counterparties demand it (homeowners/HOAs/landlords won't deal without one),
 * each verified deal raises the band -> cheaper trust -> more deals.
 */
export declare class TrustPassportService {
    /** Create / update a passport for a provider. */
    upsert(input: {
        handle: string;
        displayName: string;
        category?: string;
        agentId?: string;
        providerRef?: string;
        bio?: string;
        walletAddress?: string;
    }): Promise<any>;
    /** Public directory of passports (discovery). No auth. */
    list(params?: {
        category?: string;
        search?: string;
        limit?: number;
    }): Promise<any[]>;
    /** Public aggregation by handle. No auth. Returns a portable trust snapshot. */
    getPublic(handle: string): Promise<any>;
    /** The "Request Protected Deal" deep-link target — returns provider context
     *  so the PPD wizard can pre-fill. Reuses existing rails. */
    getRequestContext(handle: string): Promise<any>;
}
export declare const trustPassportService: TrustPassportService;
//# sourceMappingURL=trustPassport.service.d.ts.map