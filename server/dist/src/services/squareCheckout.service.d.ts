export declare class SquareService {
    /**
     * Create a Square Checkout (hosted payment page)
     * Customer is redirected to Square's hosted page
     */
    createCheckout(params: {
        referenceId: string;
        amount: number;
        currency: string;
        redirectUrl: string;
        cancelUrl: string;
        note?: string;
        customerEmail?: string;
    }): Promise<{
        id: any;
        url: any;
        orderId: any;
        referenceId: string;
    }>;
    getDefaultLocation(): Promise<string | null>;
    /**
     * Get payment details from Square
     */
    getPayment(paymentId: string): Promise<import("square").Payment>;
    /**
     * Verify a Square webhook signature
     */
    verifyWebhook(body: string, signature: string, url: string): Promise<boolean>;
    /**
     * Process Square webhook event
     */
    processWebhook(event: any): Promise<{
        type: string;
        paymentId: any;
        status: any;
        amount?: undefined;
        eventType?: undefined;
    } | {
        type: string;
        paymentId: any;
        amount: any;
        status?: undefined;
        eventType?: undefined;
    } | {
        type: string;
        eventType: any;
        paymentId?: undefined;
        status?: undefined;
        amount?: undefined;
    }>;
    /**
     * Create a refund for a payment
     */
    createRefund(paymentId: string, amountCents: number, reason: string): Promise<import("square").PaymentRefund | undefined>;
}
export declare const squareService: SquareService;
//# sourceMappingURL=squareCheckout.service.d.ts.map