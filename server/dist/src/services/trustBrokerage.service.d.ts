export type TrustDataBundleType = 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
export interface TrustDataBundle {
    bundleId: string;
    entityId: string;
    entityType: 'CUSTOMER' | 'BUSINESS';
    createdAt: number;
    validUntil: number;
    bundleType: TrustDataBundleType;
    priceUSD: number;
    data: {
        velocity: number;
        trend: string;
        confidence: number;
        riskBand: 'A' | 'B' | 'C' | 'D' | 'E';
        trustFluxSnapshot: string;
        volume24h: number;
        completionRate: number;
    };
    zkp: {
        commitment: string;
        zkProof: string;
    };
    nonce: string;
}
export interface BrokerTransaction {
    txId: string;
    buyerId: string;
    bundle: TrustDataBundle;
    priceUSD: number;
    timestamp: number;
    paymentTxHash?: string;
}
export declare class TrustBrokerageService {
    private monthlyCounts;
    private dailyRevenue;
    /**
     * Generate a Trust Data Bundle for a specific entity.
     * The bundle contains monetizable reputation signals without exposing
     * the raw trust score or event history.
     */
    createBundle(entityId: string, entityType: 'CUSTOMER' | 'BUSINESS', buyerId?: string): Promise<TrustDataBundle | null>;
    /**
     * Compute risk band from flux + reservation history.
     * A = lowest risk (rising trust, high completion), E = highest risk.
     */
    private computeRiskBand;
    private computeCompletionRate;
    /** Generate a simplified ZK proof snippet (not full ZKP, but attestation) */
    private generateZKProof;
    /** Record a broker transaction in the audit trail */
    private recordTransaction;
    /** Get daily revenue stats */
    getDailyRevenue(): number;
    /** Get monthly volume for a buyer */
    getMonthlyVolume(buyerId: string): number;
    /** Get enterprise price multiplier */
    getEnterprisePrice(): number;
}
export declare const trustBrokerageService: TrustBrokerageService;
//# sourceMappingURL=trustBrokerage.service.d.ts.map