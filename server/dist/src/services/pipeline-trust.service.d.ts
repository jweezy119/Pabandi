export declare class PipelineTrustService {
    enrichLeadWithTrust(clientId: string): Promise<{
        trustScore: number;
        trustLevel: string;
        verified: boolean;
        email: string | null;
        phone: string | null;
        id: string;
        createdAt: Date;
        name: string;
        reliabilityScore: number;
        updatedAt: Date;
        businessId: string;
        status: string;
        isActive: boolean;
        notes: string | null;
        address: string | null;
        passportId: string | null;
        customData: import("@prisma/client/runtime/library").JsonValue;
    } | null>;
    getLeadRiskScore(clientId: string): Promise<"medium" | "high" | "low">;
    suggestTerms(clientId: string): Promise<{
        terms: string;
        deposit: number;
    }>;
    flagHighRiskLeads(businessId: string): Promise<{
        email: string | null;
        phone: string | null;
        id: string;
        createdAt: Date;
        name: string;
        reliabilityScore: number;
        updatedAt: Date;
        businessId: string;
        status: string;
        isActive: boolean;
        notes: string | null;
        address: string | null;
        passportId: string | null;
        customData: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    updateScoreFromDeal(dealId: string): Promise<{
        success: boolean;
        message: string;
    } | null>;
}
export declare const pipelineTrust: PipelineTrustService;
//# sourceMappingURL=pipeline-trust.service.d.ts.map