import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_TIERS, SubscriptionTier } from '../config/subscriptions';

export class BillingService {
  async getSubscription(businessId: string) {
    let subscription = await prisma.merchantSubscription.findUnique({
      where: { businessId },
    });

    if (!subscription) {
      // Create free subscription if none exists
      subscription = await prisma.merchantSubscription.create({
        data: {
          businessId,
          tier: 'free',
          status: 'active',
        },
      });
    }

    return subscription;
  }

  async getTierLimits(tier: string) {
    const tierKey = (tier || 'free').toLowerCase() as SubscriptionTier;
    return SUBSCRIPTION_TIERS[tierKey] || SUBSCRIPTION_TIERS.free;
  }

  async checkLimit(businessId: string, limitType: 'clients' | 'invoices' | 'users' | 'api' | 'analytics'): Promise<{ allowed: boolean; reason?: string; upgradeUrl?: string }> {
    const subscription = await this.getSubscription(businessId);
    const tierDef = await this.getTierLimits(subscription.tier);

    if (limitType === 'api' && !tierDef.limits.apiAccess) {
      return { allowed: false, reason: 'M2M API access requires PRO or Business plan', upgradeUrl: '/settings?tab=billing' };
    }

    if (limitType === 'analytics' && !tierDef.limits.analytics) {
      return { allowed: false, reason: 'Advanced analytics requires PRO or Business plan', upgradeUrl: '/settings?tab=billing' };
    }

    if (limitType === 'clients' && tierDef.limits.maxClients !== null) {
      const count = await prisma.crmClient.count({ where: { businessId } });
      if (count >= tierDef.limits.maxClients) {
        return { allowed: false, reason: `You've reached the Free tier limit of ${tierDef.limits.maxClients} clients. Upgrade to continue.`, upgradeUrl: '/settings?tab=billing' };
      }
    }

    if (limitType === 'users') {
      const count = await prisma.user.count({ where: { businessMemberships: { some: { businessId } } } });
      if (count >= tierDef.limits.maxUsers) {
        return { allowed: false, reason: `Team member limit reached (${tierDef.limits.maxUsers} seats). Upgrade to add more members.`, upgradeUrl: '/settings?tab=billing' };
      }
    }

    return { allowed: true };
  }
}

export const billingService = new BillingService();
