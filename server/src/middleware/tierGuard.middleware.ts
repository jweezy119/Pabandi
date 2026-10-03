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
import { checkLimits, tierDefinition } from '../config/subscriptions';
import { getSubscription } from '../services/subscription.service';
import { CustomError } from '../middleware/errorHandler';

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
 * Resolve the caller's business. Prefers an explicit service business (the Contact OS
 * identity) and falls back to the platform business on the request.
 */
async function resolveBusinessId(
  req: Request,
  serviceBusinessId: string | null | undefined,
): Promise<string | null> {
  if (serviceBusinessId) return serviceBusinessId;

  const fromCrm = (req as any).crm?.businessId;
  if (fromCrm) return fromCrm as string;

  const fromBody = req.body?.businessId;
  if (typeof fromBody === 'string' && fromBody) return fromBody;

  const fromQuery = req.query?.businessId;
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery as string;

  const userBusinessId = (req as any).user?.businessId;
  if (typeof userBusinessId === 'string' && userBusinessId) return userBusinessId;

  return null;
}

/**
 * Express middleware enforcing a tier limit.
 *
 * Usage: `router.post('/clients', tierGuard({ resource: 'clients' }), handler)`
 */
export function tierGuard(options: TierGuardOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = await resolveBusinessId(req, options.serviceBusinessId);
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
      // A guard that throws on its own must not become an outage. Fail open and log:
      // the cost is one unmetered write, the cost of failing closed is a paying
      // merchant unable to invoice. Chosen deliberately, and worth revisiting if the
      // unmetered-write volume ever matters more than availability.
      logger.error('[TierGuard] failed to evaluate limits, allowing request', err);
      return next();
    }
  };
}