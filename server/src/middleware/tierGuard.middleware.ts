import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from './errorHandler';
import { resolvePlatformBusinessId } from './tenant.middleware';

/**
 * Feature gating by merchant tier.
 *
 * WHY 402 AND NOT 403
 * A 403 says "you may not". These callers ARE allowed — they are authenticated,
 * tenant-scoped, and the request is well-formed. What stops them is what the
 * feature costs, and the remedy is upgrading rather than being told no. 402 is
 * the honest status and it is also the only one that tells the client what to
 * do next.
 *
 * WHY THE TIER COMES FROM MerchantSubscription AND NOT THE TOKEN
 * A tier claim in a JWT is stale the moment a merchant upgrades, and a stale
 * claim on a paid feature is either a free rider or an angry customer. The
 * subscription row is the thing the fee engine charges from, so it is the only
 * answer that agrees with the bill.
 */

export interface TierFeature {
  /** Human-readable name, used verbatim in the 402 message. */
  label: string;
  /** Tiers that include the feature. Compared case-insensitively. */
  included: string[];
}

export const TIER_FEATURES: Record<string, TierFeature> = {
  smsReminders: {
    label: 'SMS reminders',
    // Deliberately above the entry rung: the $29 starter plan does not include it.
    included: ['PRO', 'BUSINESS'],
  },
};

/** Tiers that have not bought the feature, used for the upgrade message. */
const UPGRADE_TIERS = 'Pro';

export function tierFeature(feature: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const spec = TIER_FEATURES[feature];
      if (!spec) {
        // A typo in a route must fail loudly rather than silently open the feature.
        throw new CustomError(`Unknown tier feature "${feature}"`, 500);
      }

      const businessId = await resolvePlatformBusinessId(req);
      if (!businessId) {
        throw new CustomError(
          'This action needs a linked platform business. Complete business setup and try again.',
          409,
        );
      }

      const subscription = await prisma.merchantSubscription.findUnique({
        where: { businessId },
        select: { tier: true, status: true },
      });

      const tier = (subscription?.tier ?? 'free').toUpperCase();
      const entitled = spec.included.map((t) => t.toUpperCase()).includes(tier);

      if (!entitled) {
        throw new CustomError(
          `${spec.label} is not included on the ${subscription?.tier ?? 'free'} plan. ` +
            `Upgrade to ${UPGRADE_TIERS} to enable it.`,
          402,
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
