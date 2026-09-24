declare function processInvoiceStatusChange(invoiceId: string, clientId: string, oldStatus: string, newStatus: string, timestamp: Date, isPaidOnTime?: boolean, isOverdue?: boolean, isDefaulted?: boolean): Promise<void>;
export declare const invoiceTrustService: {
    processInvoiceStatusChange: typeof processInvoiceStatusChange;
};
export {};
//# sourceMappingURL=invoice-trust.service.d.ts.map