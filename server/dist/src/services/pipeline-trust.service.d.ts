export declare class PipelineTrustService {
    enrichLeadWithTrust(leadId: string): Promise<any>;
    getLeadRiskScore(leadId: string): Promise<"high" | "low" | "medium">;
    suggestTerms(leadId: string): Promise<{
        terms: string;
        deposit: number;
    }>;
    flagHighRiskLeads(businessId: string): Promise<any[]>;
    updateScoreFromDeal(dealId: string): Promise<{
        success: boolean;
        message: string;
    } | null>;
}
export declare const pipelineTrust: PipelineTrustService;
//# sourceMappingURL=pipeline-trust.service.d.ts.map