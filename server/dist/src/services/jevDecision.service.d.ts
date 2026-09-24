interface JevQuestion {
    type: 'choice' | 'score' | 'noul';
    instructions: string;
    criteria?: any;
}
export declare class JevDecisionService {
    private apiKey;
    private baseUrl;
    private model;
    constructor();
    private callJev;
    getTradingDecision(agentId: string): Promise<{
        shouldTrade: boolean;
        direction: 'buy' | 'sell' | 'hold';
        sizePercent: number;
        confidence: number;
    }>;
    getTenantRiskAssessment(tenantId: string): Promise<{
        riskLevel: 'very_low' | 'low' | 'medium' | 'high';
        riskScore: number;
        requireDeposit: boolean;
        depositMonths: number;
        confidence: number;
    }>;
    getPaymentRoute(userId: string, amountUsd: number): Promise<{
        route: 'usdc' | 'pab' | 'split';
        pabPercent: number;
        discount: number;
        confidence: number;
    }>;
    getAgentQualityScore(agentId: string): Promise<{
        qualityScore: number;
        tier: 'bronze' | 'silver' | 'gold' | 'platinum';
        bonusPab: number;
        confidence: number;
    }>;
    decide(state: Record<string, any>, questions: Record<string, JevQuestion>): Promise<Record<string, any> | null>;
}
export declare const jevDecision: JevDecisionService;
export {};
//# sourceMappingURL=jevDecision.service.d.ts.map