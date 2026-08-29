/**
 * BillingService — Stripe Metered Billing for PTP API
 * ────────────────────────────────────────────────────────────────────────────
 * Every PTP attestation, seal render, and verification is a billable event.
 * This service tracks usage and integrates with Stripe for metered billing.
 *
 * Pricing Tiers (usage-based):
 *   Pay-as-you-go: $0.15/verification (no commitment)
 *   Growth:        $0.08/verification ($99/mo minimum)
 *   Scale:         $0.05/verification ($499/mo minimum)
 *   Enterprise:    Custom pricing ($2,499/mo minimum)
 */
export type BillingTier = 'PAY_AS_YOU_GO' | 'GROWTH' | 'SCALE' | 'ENTERPRISE';
export interface BillingCustomer {
    id: string;
    apiKey: string;
    companyName: string;
    email: string;
    tier: BillingTier;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodUsage: number;
    currentPeriodStart: number;
    currentPeriodEnd: number;
    totalLifetimeUsage: number;
    totalLifetimeRevenueUSD: number;
    active: boolean;
    createdAt: number;
}
export interface UsageEvent {
    customerId: string;
    eventType: 'ATTESTATION' | 'SEAL_IMPRESSION' | 'SEAL_CLICK' | 'VERIFICATION' | 'GUARANTEE_PURCHASE';
    quantity: number;
    unitPriceUSD: number;
    metadata?: Record<string, any>;
    timestamp: number;
}
export interface InvoicePreview {
    customerId: string;
    companyName: string;
    tier: BillingTier;
    periodStart: string;
    periodEnd: string;
    totalUsage: number;
    lineItems: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }>;
    subtotalUSD: number;
    minimumFeeUSD: number;
    totalUSD: number;
}
declare const TIER_CONFIG: Record<BillingTier, {
    perVerification: number;
    monthlyMinimum: number;
    sealPricePerMonth: number;
    guaranteeFeeMultiplier: number;
}>;
export declare class BillingService {
    /**
     * Create a new billing customer with an API key.
     * In production, this creates a Stripe Customer + Subscription with metered pricing.
     */
    createCustomer(companyName: string, email: string, tier?: BillingTier): Promise<{
        customer: BillingCustomer;
        apiKey: string;
    }>;
    /**
     * Record a billable usage event.
     * In production: reports to Stripe via subscription_item.createUsageRecord()
     */
    recordUsage(apiKey: string, eventType: UsageEvent['eventType'], quantity?: number, metadata?: Record<string, any>): Promise<{
        success: boolean;
        currentUsage: number;
        estimatedCostUSD: number;
    }>;
    /**
     * Validate an API key and return the customer.
     */
    validateApiKey(apiKey: string): BillingCustomer | null;
    /**
     * Get invoice preview for the current billing period.
     */
    getInvoicePreview(apiKey: string): InvoicePreview | null;
    /**
     * Get global platform revenue stats.
     */
    getRevenueStats(): {
        totalCustomers: number;
        activeCustomers: number;
        totalUsageThisPeriod: number;
        estimatedMRR: number;
        lifetimeRevenueUSD: number;
    };
    /**
     * Get available billing tiers and pricing.
     */
    getTierPricing(): typeof TIER_CONFIG;
    private getUnitPrice;
    private eventTypeLabel;
}
export declare const billingService: BillingService;
export {};
//# sourceMappingURL=billing.service.d.ts.map