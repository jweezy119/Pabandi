export declare class LedgerTrustService {
    enrichInvoiceWithTrust(invoiceId: string): Promise<{
        clientTrustScore: number;
        clientTrustLevel: string;
        number: string;
        id: string;
        createdAt: Date;
        businessId: string;
        clientId: string | null;
        status: string;
        currency: string;
        amount: number;
        lineItems: import("@prisma/client/runtime/library").JsonValue;
        paidAt: Date | null;
        escrowId: string | null;
        dueDate: Date;
        senderId: string | null;
        recipientId: string | null;
    } | null>;
    getInvoiceRisk(invoiceId: string): Promise<"high" | "low" | "medium">;
    autoEscrowOverdue(): Promise<{
        number: string;
        id: string;
        createdAt: Date;
        businessId: string;
        clientId: string | null;
        status: string;
        currency: string;
        amount: number;
        lineItems: import("@prisma/client/runtime/library").JsonValue;
        paidAt: Date | null;
        escrowId: string | null;
        dueDate: Date;
        senderId: string | null;
        recipientId: string | null;
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