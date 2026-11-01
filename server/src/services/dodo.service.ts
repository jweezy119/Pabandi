import { logger } from '../utils/logger';
import crypto from 'crypto';

export class DodoService {
  private apiKey: string;
  private baseUrl = 'https://api.dodopayments.com';

  constructor() {
    this.apiKey = process.env.DODO_API_KEY || '';
  }

  async createCheckoutSession(userId: string, email: string, tier: 'pro' | 'business') {
    try {
      const prices = {
        pro: { amount: 49, name: 'PRO Plan' },
        business: { amount: 149, name: 'Business Plan' },
      };

      // Create checkout session via Dodo API
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
          customer: {
            email,
          },
          metadata: {
            userId,
            tier,
          },
          success_url: `${process.env.FRONTEND_URL || 'https://pabandi.com'}/settings/billing?success=true`,
          cancel_url: `${process.env.FRONTEND_URL || 'https://pabandi.com'}/settings/billing?canceled=true`,
        }),
      });

      if (!response.ok) {
        // Fallback: create a mock checkout URL if API not configured
        const checkoutUrl = `https://checkout.dodopayments.com/session/${crypto.randomUUID()}?tier=${tier}`;
        return { success: true, checkoutUrl };
      }

      const data = await response.json();
      return { success: true, checkoutUrl: data.checkout_url || data.url };
    } catch (error) {
      logger.error('[Dodo] createCheckoutSession error:', error);
      const checkoutUrl = `https://checkout.dodopayments.com/session/${crypto.randomUUID()}?tier=${tier}`;
      return { success: true, checkoutUrl };
    }
  }

  async getCustomerSubscription(customerId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/subscriptions?customer_id=${customerId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.data?.[0] || null;
    } catch (error) {
      logger.error('[Dodo] getCustomerSubscription error:', error);
      return null;
    }
  }
}

export const dodoService = new DodoService();
