export declare class InvoiceGenerationService {
    /**
     * Generate an invoice from a completed job
     */
    generateInvoiceFromJob(jobId: string): Promise<{
        number: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        businessId: string;
        status: string;
        clientId: string;
        notes: string | null;
        sentAt: Date | null;
        transactionHash: string | null;
        paidAt: Date | null;
        dateIssued: Date;
        dateDue: Date;
        lineItems: import("@prisma/client/runtime/library").JsonValue;
        subtotal: number;
        paymentLink: string | null;
        reminderCount: number;
        lastReminderAt: Date | null;
    }>;
    /**
     * Generate a new invoice number
     */
    private generateInvoiceNumber;
}
export declare const invoiceGenerationService: InvoiceGenerationService;
//# sourceMappingURL=invoiceGeneration.service.d.ts.map