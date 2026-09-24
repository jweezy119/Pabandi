export interface ReconciliationResult {
    paymentId: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
    updated: boolean;
    remoteStatus?: string;
    message?: string;
}
export interface ReconciliationOptions {
    maxAgeMs?: number;
    limit?: number;
}
export declare const paymentReconciliationService: {
    reconcileStalePayments(options?: ReconciliationOptions): Promise<ReconciliationResult[]>;
    reconcilePayment(paymentId: string): Promise<ReconciliationResult>;
};
//# sourceMappingURL=payment-reconciliation.service.d.ts.map