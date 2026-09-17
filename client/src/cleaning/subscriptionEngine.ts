import { CleaningBusinessSystem } from '../src/cleaning/businessSystem';

export class SubscriptionEngine {
  private plans = {
    basic: {
      name: 'Basic',
      price: 50,
      features: ['standard cleaning', 'weekly reports', 'email updates'],
      renewalInterval: 1,
      autoRenew: true
    },
    premium: {
      name: 'Premium',
      price: 120,
      features: ['standard cleaning', 'daily reports', 'priority dispatch', 'loyalty discounts'],
      renewalInterval: 1,
      autoRenew: true
    },
    enterprise: {
      name: 'Enterprise',
      price: 250,
      features: ['all premium features', 'dedicated account manager', 'custom scheduling', 'discount programs'],
      renewalInterval: 1,
      autoRenew: true
    }
  };

  /**
   * Calculate subscription cost for a client
   * @param tier - Subscription tier ('basic', 'premium', 'enterprise')
   * @param months - Number of months
   * @returns Total cost
   */
  calculateSubscriptionCost(tier: string, months: number): number {
    const plan = this.plans[tier] || this.plans.basic;
    return plan.price * months;
  }

  /**
   * Get client's current subscription tier
   * @param clientId - Client ID
   * @returns Subscription info
   */
  getSubscription(clientId: string): any {
    const client = this.crmService.getClient(clientId);
    if (!client) throw new Error(`Client ${clientId} not found`);
    
    // Determine tier based on subscription plan
    if (client.subscriptionTier === 'basic') return { tier: 'basic', cost: 50 };
    if (client.subscriptionTier === 'premium') return { tier: 'premium', cost: 120 };
    if (client.subscriptionTier === 'enterprise') return { tier: 'enterprise', cost: 250 };
    return { tier: 'basic', cost: 50 };
  }

  /**
   * Renew a subscription
   * @param clientId - Client ID
   * @param months - Renewal period
   * @returns Renewal confirmation
   */
  renewSubscription(clientId: string, months: number): any {
    const plan = this.plans[this.getSubscription(clientId).tier] || this.plans.basic;
    const cost = this.calculateSubscriptionCost(this.getSubscription(clientId).tier, months);
    
    return {
      success: true,
      clientId,
      plan: plan.name,
      cost,
      renewalDate: new Date(Date.now() + months * 30 * 86400000)
    };
  }
}

export default SubscriptionEngine;