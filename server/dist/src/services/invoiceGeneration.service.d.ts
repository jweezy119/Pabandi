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
        clientId: string;
        status: string;
        notes: string | null;
        sentAt: Date | null;
        dateIssued: Date;
        dateDue: Date;
        lineItems: import("@prisma/client/runtime/library").JsonValue;
        subtotal: number;
        paidAt: Date | null;
    }>;
    /**
     * Generate a new invoice number
     */
    private generateInvoiceNumber;
}
export declare const invoiceGenerationService: InvoiceGenerationService;
//# sourceMappingURL=invoiceGeneration.service.d.ts.map