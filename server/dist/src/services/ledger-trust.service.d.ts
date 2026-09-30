export declare class LedgerTrustService {
    enrichInvoiceWithTrust(invoiceId: string): Promise<{
        clientTrustScore: number;
        clientTrustLevel: string;
        number: string;
        id: string;
        createdAt: Date;
        businessId: string;
        status: string;
        clientId: string | null;
        currency: string;
        amount: number;
        dueDate: Date;
        senderId: string | null;
        paidAt: Date | null;
        recipientId: string | null;
        escrowId: string | null;
        lineItems: import("@prisma/client/runtime/library").JsonValue;
    } | null>;
    getInvoiceRisk(invoiceId: string): Promise<"medium" | "high" | "low">;
    autoEscrowOverdue(): Promise<{
        number: string;
        id: string;
        createdAt: Date;
        businessId: string;
        status: string;
        clientId: string | null;
        currency: string;
        amount: number;
        dueDate: Date;
        senderId: string | null;
        paidAt: Date | null;
        recipientId: string | null;
        escrowId: string | null;
        lineItems: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    lowerScoreOnLatePayment(invoiceId: string): Promise<{
        success: boolean;
    } | null>;
    suggestCreditTerms(clientId: string): Promise<{
        clientId: string;
        score: number;
        terms: string;
        creditLimit: number;
    }>;
    generateTrustReport(businessId: string): Promise<{
        businessId: string;
        totalRevenue: number;
        totalExpenses: number;
        netCashflow: number;
        invoiceCount: number;
        expenseCount: number;
    }>;
}
export declare const ledgerTrust: LedgerTrustService;
//# sourceMappingURL=ledger-trust.service.d.ts.map