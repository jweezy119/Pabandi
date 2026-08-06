import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';

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

const TIER_CONFIG: Record<BillingTier, {
  perVerification: number;
  monthlyMinimum: number;
  sealPricePerMonth: number;
  guaranteeFeeMultiplier: number;
}> = {
  PAY_AS_YOU_GO: { perVerification: 0.15, monthlyMinimum: 0, sealPricePerMonth: 29, guaranteeFeeMultiplier: 1.0 },
  GROWTH:        { perVerification: 0.08, monthlyMinimum: 99, sealPricePerMonth: 29, guaranteeFeeMultiplier: 0.9 },
  SCALE:         { perVerification: 0.05, monthlyMinimum: 499, sealPricePerMonth: 0, guaranteeFeeMultiplier: 0.7 },
  ENTERPRISE:    { perVerification: 0.03, monthlyMinimum: 2499, sealPricePerMonth: 0, guaranteeFeeMultiplier: 0.5 },
};

// In-memory store (production: Stripe API + DB)
const customers = new Map<string, BillingCustomer>();
const usageLog: UsageEvent[] = [];
const apiKeyToCustomer = new Map<string, string>();

export class BillingService {

  /**
   * Create a new billing customer with an API key.
   * In production, this creates a Stripe Customer + Subscription with metered pricing.
   */
  public async createCustomer(
    companyName: string,
    email: string,
    tier: BillingTier = 'PAY_AS_YOU_GO'
  ): Promise<{ customer: BillingCustomer; apiKey: string }> {
    const id = `cust_${crypto.randomBytes(8).toString('hex')}`;
    const apiKey = `pk_live_${crypto.randomBytes(32).toString('hex')}`;
    const now = Date.now();

    // In production: Stripe API calls
    // const stripeCustomer = await stripe.customers.create({ email, name: companyName });
    // const subscription = await stripe.subscriptions.create({ ... metered pricing ... });

    const customer: BillingCustomer = {
      id,
      apiKey,
      companyName,
      email,
      tier,
      currentPeriodUsage: 0,
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000, // 30 days
      totalLifetimeUsage: 0,
      totalLifetimeRevenueUSD: 0,
      active: true,
      createdAt: now,
    };

    customers.set(id, customer);
    apiKeyToCustomer.set(apiKey, id);

    logger.info(`[Billing] Customer created: ${companyName} (${tier}, API key: ${apiKey.substring(0, 16)}...)`);

    return { customer, apiKey };
  }

  /**
   * Record a billable usage event.
   * In production: reports to Stripe via subscription_item.createUsageRecord()
   */
  public async recordUsage(
    apiKey: string,
    eventType: UsageEvent['eventType'],
    quantity: number = 1,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; currentUsage: number; estimatedCostUSD: number }> {
    const customerId = apiKeyToCustomer.get(apiKey);
    if (!customerId) {
      return { success: false, currentUsage: 0, estimatedCostUSD: 0 };
    }

    const customer = customers.get(customerId);
    if (!customer || !customer.active) {
      return { success: false, currentUsage: 0, estimatedCostUSD: 0 };
    }

    const config = TIER_CONFIG[customer.tier];
    const unitPrice = this.getUnitPrice(eventType, config);

    const event: UsageEvent = {
      customerId,
      eventType,
      quantity,
      unitPriceUSD: unitPrice,
      metadata,
      timestamp: Date.now(),
    };

    usageLog.push(event);
    customer.currentPeriodUsage += quantity;
    customer.totalLifetimeUsage += quantity;
    customer.totalLifetimeRevenueUSD += unitPrice * quantity;

    // In production: report to Stripe
    // await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    //   quantity,
    //   timestamp: Math.floor(Date.now() / 1000),
    //   action: 'increment',
    // });

    return {
      success: true,
      currentUsage: customer.currentPeriodUsage,
      estimatedCostUSD: Math.round(customer.currentPeriodUsage * unitPrice * 100) / 100,
    };
  }

  /**
   * Validate an API key and return the customer.
   */
  public validateApiKey(apiKey: string): BillingCustomer | null {
    const customerId = apiKeyToCustomer.get(apiKey);
    if (!customerId) return null;
    const customer = customers.get(customerId);
    if (!customer || !customer.active) return null;
    return customer;
  }

  /**
   * Get invoice preview for the current billing period.
   */
  public getInvoicePreview(apiKey: string): InvoicePreview | null {
    const customer = this.validateApiKey(apiKey);
    if (!customer) return null;

    const config = TIER_CONFIG[customer.tier];
    const customerEvents = usageLog.filter(e =>
      e.customerId === customer.id && e.timestamp >= customer.currentPeriodStart
    );

    // Group by event type
    const grouped = new Map<string, { quantity: number; unitPrice: number }>();
    for (const event of customerEvents) {
      const key = event.eventType;
      const existing = grouped.get(key) || { quantity: 0, unitPrice: event.unitPriceUSD };
      existing.quantity += event.quantity;
      grouped.set(key, existing);
    }

    const lineItems = Array.from(grouped.entries()).map(([type, data]) => ({
      description: this.eventTypeLabel(type),
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      total: Math.round(data.quantity * data.unitPrice * 100) / 100,
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const total = Math.max(subtotal, config.monthlyMinimum);

    return {
      customerId: customer.id,
      companyName: customer.companyName,
      tier: customer.tier,
      periodStart: new Date(customer.currentPeriodStart).toISOString(),
      periodEnd: new Date(customer.currentPeriodEnd).toISOString(),
      totalUsage: customer.currentPeriodUsage,
      lineItems,
      subtotalUSD: Math.round(subtotal * 100) / 100,
      minimumFeeUSD: config.monthlyMinimum,
      totalUSD: Math.round(total * 100) / 100,
    };
  }

  /**
   * Get global platform revenue stats.
   */
  public getRevenueStats(): {
    totalCustomers: number;
    activeCustomers: number;
    totalUsageThisPeriod: number;
    estimatedMRR: number;
    lifetimeRevenueUSD: number;
  } {
    let activeCount = 0;
    let totalUsage = 0;
    let lifetimeRevenue = 0;
    let estimatedMRR = 0;

    for (const customer of customers.values()) {
      if (customer.active) {
        activeCount++;
        totalUsage += customer.currentPeriodUsage;
        const config = TIER_CONFIG[customer.tier];
        estimatedMRR += Math.max(
          customer.currentPeriodUsage * config.perVerification,
          config.monthlyMinimum
        );
      }
      lifetimeRevenue += customer.totalLifetimeRevenueUSD;
    }

    return {
      totalCustomers: customers.size,
      activeCustomers: activeCount,
      totalUsageThisPeriod: totalUsage,
      estimatedMRR: Math.round(estimatedMRR * 100) / 100,
      lifetimeRevenueUSD: Math.round(lifetimeRevenue * 100) / 100,
    };
  }

  /**
   * Get available billing tiers and pricing.
   */
  public getTierPricing(): typeof TIER_CONFIG {
    return TIER_CONFIG;
  }

  // ── Private Methods ──────────────────────────────────────────────────

  private getUnitPrice(eventType: UsageEvent['eventType'], config: typeof TIER_CONFIG[BillingTier]): number {
    switch (eventType) {
      case 'ATTESTATION':        return config.perVerification;
      case 'VERIFICATION':       return config.perVerification;
      case 'SEAL_IMPRESSION':    return config.perVerification * 0.1; // 10% of verification price
      case 'SEAL_CLICK':         return config.perVerification * 0.5; // 50% of verification price
      case 'GUARANTEE_PURCHASE': return 0; // Guarantee fee is separate
      default:                   return config.perVerification;
    }
  }

  private eventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'ATTESTATION': 'PTP Attestation Issuance',
      'VERIFICATION': 'Attestation Verification',
      'SEAL_IMPRESSION': 'Trust Seal Impression',
      'SEAL_CLICK': 'Trust Seal Click-Through',
      'GUARANTEE_PURCHASE': 'Transaction Guarantee',
    };
    return labels[type] || type;
  }
}

export const billingService = new BillingService();
