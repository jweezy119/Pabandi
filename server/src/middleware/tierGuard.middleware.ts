/**
 * Tier entitlement — the gate between a plan's limits and the routes that can breach them.
 *
 * WHY THIS EXISTS
 * ---------------
 * `config/subscriptions.ts` defines three tiers with real limits, and
 * `checkLimits` evaluates them correctly. Both had ZERO callers. `POST /crm/clients`,
 * `/crm/jobs` and `/crm/invoices` had no tier check at all, so a free business could
 * create unlimited clients, jobs and invoices. The $49 and $149 plans were described
 * and could not be charged for.
 *
 * This is the cheapest revenue in the codebase: the product is already built, the
 * limits are already written, and the only missing thing was the door.
 *
 * THE DELIBERATE DECISION: 402, not a silent block
 * ------------------------------------------------
 * The alternative is to keep accepting the write and email the owner about it later.
 * That is friendlier and it is worse for the business: usage that is not blocked is
 * usage that is not billed, and the whole value of a limit is that exceeding it
 * creates a reason to upgrade. So we refuse the write, and the refusal says what to do.
 *
 * What we do NOT do is break a paying customer to protect this. A `past_due` merchant
 * has already been charged and not paid — cutting them off immediately turns a
 * billing problem into a business outage, and they cannot fix it by paying us faster.
 * They fall back to the free tier's limits and are told why. That is the humane
 * version, and it still has a ceiling.
 *
 * WHAT THIS DOES NOT GATE
 * -----------------------
 * Bookings, deposits, escrow and check-in. Those are the customer-facing money path and
 * must work on the free tier — a business that cannot take a booking because it has 51
 * clients has been damaged by our billing, not protected by it. Enforcing limits on the
 * operations a merchant needs to trade would be the fastest way to lose them.
 */

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { checkLimits, tierDefinition, tierLimits } from '../config/subscriptions';
import { getSubscription } from '../services/subscription.service';
import { CustomError } from '../middleware/errorHandler';
import { resolvePlatformBusinessId } from './tenant.middleware';

/**
 * Usage counts for the two limits that gate writes.
 *
 * Scoped by businessId on every query. An uncapped count would let one business's
 * volume lock out another, which is both a support incident and a way to grief.
 */
async function currentUsage(businessId: string, serviceBusinessId: string | null) {
  const [clients, invoicesThisMonth, jobs] = await Promise.all([
    prisma.crmClient.count({
      where: serviceBusinessId ? { serviceBusinessId } : { businessId },
    }),
    prisma.invoice.count({
      where: {
        businessId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.crmJob.count({
      where: serviceBusinessId ? { serviceBusinessId } : { businessId },
    }),
  ]);
  return { clients, invoicesThisMonth, jobs };
}

export interface TierGuardOptions {
  /**
   * Which limit this route consumes. `clients` is checked before adding a client,
   * `invoices` before creating an invoice. `jobs` is counted but not capped — there
   * is no `maxJobsPerMonth` on any tier, and inventing one here would quietly impose
   * a limit nobody agreed to pay for.
   */
  resource: 'clients' | 'invoices' | 'jobs';
  /** Default when the caller has no CRM service business — the booking-flow identity. */
  serviceBusinessId?: string | null;
}

/**
 * Express middleware enforcing a tier limit.
 *
 * Usage: `router.post('/clients', tierGuard({ resource: 'clients' }), handler)`
 */
export function tierGuard(options: TierGuardOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = await resolvePlatformBusinessId(req, { serviceBusinessId: options.serviceBusinessId });
      if (!businessId) {
        // No tenant to evaluate. Refusing is right: without a tenant there is nothing
        // to bill, and guessing one would apply some other business's limit.
        return next(new CustomError('No business is associated with this request', 403));
      }

      const [subscription, usage] = await Promise.all([
        getSubscription(businessId),
        currentUsage(businessId, options.serviceBusinessId ?? null),
      ]);

      const tier = subscription.tier;

      // `checkLimits` reports only what is ALREADY over the cap, so it cannot be
      // used to gate a write on its own: at exactly 50 clients it says "allowed",
      // and an early return on that would let the 51st client through. The unit
      // tests caught this. So it is used for its diagnostic message, and the
      // decision below compares usage + 1 against the cap — the limit the caller is
      // about to create, not the count they already hold.
      const result = checkLimits(tier, {
        clients: usage.clients,
        invoicesThisMonth: usage.invoicesThisMonth,
      });

      const limits = tierDefinition(tier).limits;
      let blocking: string | null = null;

      if (options.resource === 'clients' && limits.maxClients !== null && usage.clients + 1 > limits.maxClients) {
        blocking = `The ${tier} plan includes up to ${limits.maxClients} clients.`;
      }
      if (
        options.resource === 'invoices' &&
        limits.maxInvoicesPerMonth !== null &&
        usage.invoicesThisMonth + 1 > limits.maxInvoicesPerMonth
      ) {
        blocking = `The ${tier} plan includes up to ${limits.maxInvoicesPerMonth} invoices a month.`;
      }

      if (!blocking) return next();

      logger.info(
        `[TierGuard] blocked ${options.resource} for ${businessId} on ${tier}: ` +
          `${usage.clients} clients, ${usage.invoicesThisMonth} invoices this month` +
          (result.violations.length ? ` (${result.violations.join('; ')})` : ''),
      );

      // 402 Payment Required: the request is well-formed and authorised, and it is
      // refused because of what it would cost. 403 would say they may not do this at
      // all, which is not true.
      return next(
        new CustomError(
          `${blocking} Upgrade your plan to continue — your existing records are unaffected.`,
          402,
        ),
      );
    } catch (err) {
      // A DELIBERATE REFUSAL is not an internal error, and must never be failed open.
      //
      // The catch below used to swallow everything, including the 401/403 that tenant
      // resolution raises for "not signed in" and "no business". That silently turned an
      // authentication failure into an ALLOWED request — the exact inverse of what the
      // guard is for, and invisible because the request then succeeded.
      //
      // So: forward anything that carries a 4xx, and only fail open on a genuine fault
      // (a database timeout, say), where the trade-off really is availability.
      if (isRefusal(err)) return next(err);

      // A guard that throws on its own must not become an outage. Fail open and log:
      // the cost is one unmetered write, the cost of failing closed is a paying
      // merchant unable to invoice. Chosen deliberately, and worth revisiting if the
      // unmetered-write volume ever matters more than availability.
      logger.error('[TierGuard] failed to evaluate limits, allowing request', err);
      return next();
    }
  };
}

/**
 * Is this error a decision rather than a fault?
 *
 * Anything with a 4xx status is the guard saying "no" on purpose. It has to reach the
 * caller intact, or the guard's own refusal becomes an unexplained success.
 */
function isRefusal(err: unknown): boolean {
  const code = (err as { statusCode?: number })?.statusCode;
  return typeof code === 'number' && code >= 400 && code < 500;
}

// ─── Feature entitlements ─────────────────────────────────────────────────────

/** Boolean capabilities a tier can grant. Mirrors the flags on TierLimits. */
export type TierFeature =
  | 'smsReminders'
  | 'emailReminders'
  | 'analytics'
  | 'apiAccess'
  | 'webhooks'
  | 'customFields'
  | 'whiteLabel';

/**
 * Refuse a request whose TIER does not include `feature`.
 *
 * WHY THIS EXISTS
 * ---------------
 * `smsReminders` was declared on every tier in config/subscriptions.ts, priced into
 * the $49 plan, advertised on the pricing page — and read by nothing. `POST /sms/send`
 * had no tier check, so a free account could send billed SMS. The tier said "SMS is a
 * paid feature" and the server did not agree.
 *
 * Fails CLOSED, unlike the numeric `tierGuard` above which fails open on its own
 * errors. The asymmetry is deliberate: an unmetered CRM write is a bookkeeping problem,
 * whereas an unmetered SMS send spends real money with a third party on every call.
 * When in doubt about this guard, close it.
 *
 * 402 rather than 403, for the same reason as tierGuard: the request is authorised and
 * refused because of what it would cost, not because they may not do it at all.
 */
export function tierFeature(feature: TierFeature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Throws a 401/403 with a usable message when there is no tenant, so this gate
      // does not have to invent its own version of that answer.
      const businessId = await resolvePlatformBusinessId(req);
      if (!businessId) {
        // Enrolled, but no platform Business row to bill or log against. There is no
        // tier to evaluate, and guessing one would apply some other business's limits.
        return next(
          new CustomError(
            'This action needs a linked platform business. Complete business setup and try again.',
            409,
          ),
        );
      }

      const subscription = await getSubscription(businessId);
      const tier = subscription.tier;
      const limits = tierLimits(tier) as unknown as Record<string, unknown>;

      if (limits[feature] === true) return next();

      logger.info(
        `[TierFeature] blocked ${feature} for ${businessId} on ${tier}`,
      );
      return next(
        new CustomError(
          `${labelFor(feature)} is not included on the ${tier} plan. ` +
            'Upgrade to enable it — your existing records are unaffected.',
          402,
        ),
      );
    } catch (err) {
      // Forward a refusal (401/403/409) unchanged. Reporting it as a 503 would tell the
      // caller to retry something that will never succeed.
      if (isRefusal(err)) return next(err);

      logger.error(`[TierFeature] failed to evaluate ${feature}, refusing request`, err);
      return next(
        new CustomError('Could not verify your plan for this action. Please try again.', 503),
      );
    }
  };
}

function labelFor(feature: TierFeature): string {
  const labels: Record<TierFeature, string> = {
    smsReminders: 'SMS reminders',
    emailReminders: 'Email reminders',
    analytics: 'Analytics',
    apiAccess: 'API access',
    webhooks: 'Webhooks',
    customFields: 'Custom fields',
    whiteLabel: 'White label',
  };
  return labels[feature];
}
