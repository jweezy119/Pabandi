export interface CheckRequest {
    subjectType: 'FREELANCER' | 'PROPERTY_MANAGER' | 'BUSINESS' | 'GUEST';
    subjectName: string;
    subjectId?: string;
    subjectEmail?: string;
    subjectPhone?: string;
    subjectWallet?: string;
    subjectGithub?: string;
    subjectWebsite?: string;
    subjectCompany?: string;
    requestedBy?: string;
    trigger?: 'MANUAL' | 'PRE_BOOKING' | 'RECURRING' | 'BATCH';
    /** PECA / PDPA-ready: explicit consent to run identity/OSINT/wallet screening. Required in REGULATED mode. */
    consent?: boolean;
    /** Purpose + retention shown to the subject at consent time (audit). */
    consentPurpose?: string;
    webhookUrl?: string;
    /** Optional custom fee (defaults to PAB_FEE_PER_CHECK). Lets the caller pay a */
    /** custom rate or waive for whitelisted/bulk tiers. */
    pabFee?: number;
}
export interface ModuleResult {
    source: string;
    riskScore: number;
    signals: string[];
    raw?: any;
    error?: string;
}
export declare class BackgroundCheckService {
    createCheck(req: CheckRequest): Promise<string>;
    runCheck(checkId: string): Promise<void>;
    getCheck(checkId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        webhookUrl: string | null;
        status: string;
        riskScore: number | null;
        completedAt: Date | null;
        trigger: string;
        subjectType: string;
        subjectId: string | null;
        subjectName: string;
        subjectEmail: string | null;
        subjectPhone: string | null;
        subjectWallet: string | null;
        subjectGithub: string | null;
        subjectWebsite: string | null;
        subjectCompany: string | null;
        requestedBy: string | null;
        riskBand: string | null;
        recommendation: string | null;
        summary: string | null;
        githubResult: import("@prisma/client/runtime/library").JsonValue | null;
        domainResult: import("@prisma/client/runtime/library").JsonValue | null;
        newsResult: import("@prisma/client/runtime/library").JsonValue | null;
        breachResult: import("@prisma/client/runtime/library").JsonValue | null;
        sanctionsResult: import("@prisma/client/runtime/library").JsonValue | null;
        registryResult: import("@prisma/client/runtime/library").JsonValue | null;
        osintResult: import("@prisma/client/runtime/library").JsonValue | null;
        gigHistoryResult: import("@prisma/client/runtime/library").JsonValue | null;
        walletResult: import("@prisma/client/runtime/library").JsonValue | null;
        pabandiHistoryResult: import("@prisma/client/runtime/library").JsonValue | null;
        temporalAlignment: number | null;
        aiRationale: string | null;
        identityConfidence: number | null;
        competenceConfidence: number | null;
        integrityConfidence: number | null;
        pabFee: number;
    } | null>;
    listChecks(filter?: {
        subjectType?: string;
        status?: string;
        requestedBy?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        webhookUrl: string | null;
        status: string;
        riskScore: number | null;
        completedAt: Date | null;
        trigger: string;
        subjectType: string;
        subjectId: string | null;
        subjectName: string;
        subjectEmail: string | null;
        subjectPhone: string | null;
        subjectWallet: string | null;
        subjectGithub: string | null;
        subjectWebsite: string | null;
        subjectCompany: string | null;
        requestedBy: string | null;
        riskBand: string | null;
        recommendation: string | null;
        summary: string | null;
        githubResult: import("@prisma/client/runtime/library").JsonValue | null;
        domainResult: import("@prisma/client/runtime/library").JsonValue | null;
        newsResult: import("@prisma/client/runtime/library").JsonValue | null;
        breachResult: import("@prisma/client/runtime/library").JsonValue | null;
        sanctionsResult: import("@prisma/client/runtime/library").JsonValue | null;
        registryResult: import("@prisma/client/runtime/library").JsonValue | null;
        osintResult: import("@prisma/client/runtime/library").JsonValue | null;
        gigHistoryResult: import("@prisma/client/runtime/library").JsonValue | null;
        walletResult: import("@prisma/client/runtime/library").JsonValue | null;
        pabandiHistoryResult: import("@prisma/client/runtime/library").JsonValue | null;
        temporalAlignment: number | null;
        aiRationale: string | null;
        identityConfidence: number | null;
        competenceConfidence: number | null;
        integrityConfidence: number | null;
        pabFee: number;
    }[]>;
    /**
     * Recurring re-screening — call from a scheduler to refresh high-value subjects.
     */
    recheckDue(): Promise<number>;
    /**
     * Batch screening — used by funnel to vet many freelancers/property managers at once.
     */
    batchScreen(requests: CheckRequest[]): Promise<string[]>;
}
export declare const backgroundCheckService: BackgroundCheckService;
//# sourceMappingURL=backgroundCheck.service.d.ts.map