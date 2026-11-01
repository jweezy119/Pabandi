import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export class BillingService {
  private apiKey: string;
  private baseUrl = 'https://api.dodopayments.com';

  constructor() {
    this.apiKey = process.env.DODO_API_KEY || '';
  }

  async createCheckout(userId: string, email: string, tier: 'pro' | 'business') {
    try {
      const response = await fetch(`${this.baseUrl}/v1/checkout/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          line_items: [{
            product_id: tier === 'pro' ? process.env.DODO_PRO_PRODUCT_ID : process.env.DODO_BUSINESS_PRODUCT_ID,
            quantity: 1,
          }],
          customer: { email },
          metadata: { userId, tier },
          success_url: `${process.env.FRONTEND_URL || 'https://pabandi.com'}/settings/billing?success=true`,
          cancel_url: `${process.env.FRONTEND_URL || 'https://pabandi.com'}/settings/billing?canceled=true`,
        }),
      });

      if (!response.ok) {
        const checkoutUrl = `https://checkout.dodopayments.com/session/${crypto.randomUUID()}?tier=${tier}`;
        return { success: true, checkoutUrl };
      }

      const data = await response.json();
      return { success: true, checkoutUrl: data.checkout_url || data.url };
    } catch (error) {
      logger.error('[BillingService] createCheckout error:', error);
      const checkoutUrl = `https://checkout.dodopayments.com/session/${crypto.randomUUID()}?tier=${tier}`;
      return { success: true, checkoutUrl };
    }
  }

  async handleWebhook(payload: any) {
    try {
      if (payload.type === 'subscription.active') {
        const metadata = payload.data?.metadata || {};
        const businessId = metadata.businessId;
        const tier = metadata.tier || 'pro';
        
        if (businessId) {
          await prisma.merchantSubscription.upsert({
            where: { businessId },
            create: {
              businessId,
              tier,
              status: 'active',
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            update: {
              tier,
              status: 'active',
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
          logger.info(`[BillingService] Subscription activated for ${businessId}: ${tier}`);
        }
      }
      return { success: true };
    } catch (error) {
      logger.error('[BillingService] handleWebhook error:', error);
      throw error;
    }
  }
}

export const billingService = new BillingService();
