export type FiatMethod = 'PAYPAL' | 'VENMO' | 'CASH_APP' | 'ZELLE' | 'ACH' | 'CARD' | 'CASH' | 'CHECK';
export interface PayeeConfig {
    paypalEmail?: string;
    venmoHandle?: string;
    cashAppTag?: string;
    zelleEmail?: string;
    zellePhone?: string;
    bankName?: string;
    bankAccount?: string;
    bankRouting?: string;
}
export interface CreateFiatPaymentInput {
    method: FiatMethod;
    amount: number;
    reference?: string;
    payerEmail?: string;
    payerId?: string;
    payeeId: string;
    businessId?: string;
    payeeConfig: PayeeConfig;
    currency?: string;
}
export interface FiatPaymentRequest {
    type: 'fiat';
    method: FiatMethod;
    reference: string;
    paymentUrl?: string;
    instructions: string;
    qrData?: string;
    amount: number;
    currency: string;
    status: string;
    escrowId?: string;
}
export interface FiatMethodInfo {
    id: FiatMethod;
    label: string;
    icon: string;
    description: string;
    hasQR: boolean;
    requiresBusinessConfirmation: boolean;
}
export declare const FIAT_METHODS: FiatMethodInfo[];
export declare function calculateCreationFee(amount: number): number;
export declare function calculateReleaseFee(amount: number): number;
export declare function generatePaymentQR(method: FiatMethod, identifier: string, amount: number, reference: string): string;
export declare function createFiatPayment(input: CreateFiatPaymentInput): Promise<FiatPaymentRequest>;
export declare function getFiatPaymentStatus(reference: string): Promise<{
    business: {
        id: string;
        name: string;
    } | null;
    escrow: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        amount: number;
        releasedAt: Date | null;
        paymentId: string | null;
        releasedBy: string | null;
        refundReason: string | null;
        payerId: string;
        payeeId: string;
    } | null;
    payer: {
        email: string;
        id: string;
        firstName: string;
        lastName: string;
    } | null;
    payee: {
        email: string;
        id: string;
        firstName: string;
        lastName: string;
    };
} & {
    method: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    businessId: string | null;
    status: string;
    currency: string;
    amount: number;
    instructions: string | null;
    escrowId: string | null;
    reference: string;
    payerId: string | null;
    payeeId: string;
    paymentUrl: string | null;
    confirmedAt: Date | null;
    confirmedBy: string | null;
    rejectionReason: string | null;
}>;
export declare function confirmFiatPayment(reference: string, confirmedBy: string): Promise<{
    success: boolean;
    escrowId?: string;
    error?: string;
}>;
export declare function rejectFiatPayment(reference: string, rejectedBy: string, reason?: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function cancelFiatPayment(reference: string, cancelledBy: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function markFiatPaymentSent(reference: string, userId: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function listPendingFiatPayments(businessId: string): Promise<({
    payer: {
        email: string;
        id: string;
        firstName: string;
        lastName: string;
    } | null;
} & {
    method: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    businessId: string | null;
    status: string;
    currency: string;
    amount: number;
    instructions: string | null;
    escrowId: string | null;
    reference: string;
    payerId: string | null;
    payeeId: string;
    paymentUrl: string | null;
    confirmedAt: Date | null;
    confirmedBy: string | null;
    rejectionReason: string | null;
})[]>;
export declare function listUserFiatPayments(userId: string): Promise<({
    business: {
        id: string;
        name: string;
    } | null;
    escrow: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        amount: number;
        releasedAt: Date | null;
        paymentId: string | null;
        releasedBy: string | null;
        refundReason: string | null;
        payerId: string;
        payeeId: string;
    } | null;
    payer: {
        email: string;
        id: string;
        firstName: string;
        lastName: string;
    } | null;
    payee: {
        email: string;
        id: string;
        firstName: string;
        lastName: string;
    };
} & {
    method: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    businessId: string | null;
    status: string;
    currency: string;
    amount: number;
    instructions: string | null;
    escrowId: string | null;
    reference: string;
    payerId: string | null;
    payeeId: string;
    paymentUrl: string | null;
    confirmedAt: Date | null;
    confirmedBy: string | null;
    rejectionReason: string | null;
})[]>;
export declare function getAvailableFiatMethods(): FiatMethodInfo[];
export declare const fiatPaymentService: {
    createFiatPayment: typeof createFiatPayment;
    getFiatPaymentStatus: typeof getFiatPaymentStatus;
    confirmFiatPayment: typeof confirmFiatPayment;
    rejectFiatPayment: typeof rejectFiatPayment;
    cancelFiatPayment: typeof cancelFiatPayment;
    markFiatPaymentSent: typeof markFiatPaymentSent;
    listPendingFiatPayments: typeof listPendingFiatPayments;
    listUserFiatPayments: typeof listUserFiatPayments;
    getAvailableFiatMethods: typeof getAvailableFiatMethods;
    generatePaymentQR: typeof generatePaymentQR;
    calculateCreationFee: typeof calculateCreationFee;
    calculateReleaseFee: typeof calculateReleaseFee;
};
//# sourceMappingURL=fiatPayment.service.d.ts.map