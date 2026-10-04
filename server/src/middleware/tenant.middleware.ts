import type { Request } from 'express';
import { CustomError } from './errorHandler';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/**
 * ONE resolver for "which tenant is this request acting on".
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The codebase grew three separate answers to that question and they disagreed:
 *
 *   1. `resolveCrmBusiness`  — trusts `req.body.businessId` / `req.query.businessId`,
 *      but pairs it with `ownerId: userId`, so an unowned id resolves to nothing. Sound.
 *   2. `tierGuard.resolveBusinessId` — falls back to `req.body.businessId` and
 *      `req.query.businessId` with NO ownership predicate at all.
 *   3. `resolveOwnedBusinessId` (added with the SMS work) — server-derived sources only.
 *
 * Three answers means a new route picks one at random, and the wrong one is silent. The
 * dangerous property of (2) is not that it is used today — every current caller runs
 * after `resolveCrmBusiness`, so the body fallback is unreachable — it is that the next
 * route to mount `tierGuard` outside the CRM router inherits it, and a limit evaluated
 * against someone else's usage is not an error anyone would notice.
 *
 * So the fallbacks are gone, and there is now one function.
 *
 * THE TWO BUSINESS IDENTITIES, NAMED
 * ----------------------------------
 * There are two of them and conflating them is item 3.3 on the backlog:
 *
 *   serviceBusinessId — `CrmServiceBusiness.id`. Operational records: jobs, clients,
 *                       payroll. Created by /crm/enroll.
 *   businessId        — platform `Business.id`. Cross-layer joins: invoices, SMSLog,
 *                       bookings. Can be null for a service business with no linked
 *                       platform Business row.
 *
 * A caller who has enrolled but never linked a platform business has a
 * `serviceBusinessId` and no `businessId`. Anything that writes an `Invoice` or an
 * `SMSLog` needs the latter and must be told plainly that it is missing, rather than
 * writing null and failing later inside Prisma — which is exactly what
 * `POST /invoices/:id/pay` did before the token reissue.
 */

export interface Tenant {
  /** Platform Business.id — the FK that invoices, SMSLog and bookings key off. */
  businessId: string | null;
  /** CrmServiceBusiness.id — the FK that clients, jobs and payroll key off. */
  serviceBusinessId: string;
  /** The authenticated user this tenant was resolved for. */
  ownerUserId: string;
  /** Where the answer came from. Logged when a request is refused, to make bugs findable. */
  source: 'crm-context' | 'token' | 'service-business-id';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

/**
 * Resolve the caller's tenant from SERVER-DERIVED identity only.
 *
 * Sources, in order:
 *   1. `req.crm` — set by `resolveCrmBusiness`, which already verified `ownerId`.
 *   2. the verified JWT's `businessId` claim.
 *   3. an explicitly supplied `CrmServiceBusiness.id`, but ONLY after confirming the
 *      caller owns that row. This is the one caller-influenced input, and it is
 *      ownership-checked rather than trusted.
 *
 * Body and query are NOT consulted. A caller-supplied id is an assertion, not a fact.
 * Admin and impersonation surfaces that genuinely need to act on another tenant must
 * say so explicitly through their own authorised path, not by smuggling an id in a body
 * where a guard might read it.
 *
 * @throws CustomError 401 unauthenticated, 403 authenticated with no tenant.
 */
export async function resolveTenant(
  req: Request,
  opts: { serviceBusinessId?: string | null } = {},
): Promise<Tenant> {
  const businessId = await resolvePlatformBusinessId(req, opts);

  // An explicit service business id short-circuits the lookup below; it was already
  // ownership-checked on the way in.
  if (opts.serviceBusinessId) {
    const owned = await prisma.crmServiceBusiness.findFirst({
      where: { id: opts.serviceBusinessId, ownerId: (req as any).user?.id },
      select: { id: true, businessId: true },
    });
    /* resolvePlatformBusinessId already refused it if unowned, so this cannot be null */
    return {
      businessId: owned?.businessId ?? businessId,
      serviceBusinessId: opts.serviceBusinessId,
      ownerUserId: (req as any).user?.id,
      source: 'service-business-id',
    };
  }

  // The token only carries the platform id, so the service business still has to be
  // found. CRM context would have short-circuited this already.
  const row = await prisma.crmServiceBusiness.findFirst({
    where: { ownerId: (req as any).user?.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, businessId: true },
  });
  if (!row) {
    throw new CustomError(
      'No business workspace is associated with this account. Finish setting up your business first.',
      403,
    );
  }

  return {
    businessId: row.businessId ?? businessId,
    serviceBusinessId: row.id,
    ownerUserId: (req as any).user?.id,
    source: 'token',
  };
}

/**
 * Resolve ONLY the platform `Business.id`, without touching the database on the common
 * paths.
 *
 * Split out from `resolveTenant` because most callers — the tier gates, the SMS router —
 * need the platform id and nothing else. Making them call the full resolver forced a
 * `crmServiceBusiness` query on every CRM write purely to obtain an id they already had,
 * which is both slower and a needless coupling: a limit check should not depend on the
 * CRM tables existing.
 *
 * Returns null when the caller genuinely has no platform business, so the caller can
 * choose between "refuse" and "fail closed" deliberately.
 */
export async function resolvePlatformBusinessId(
  req: Request,
  opts: { serviceBusinessId?: string | null } = {},
): Promise<string | null> {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) {
    throw new CustomError('Authentication required', 401);
  }

  // 1. CRM context — resolveCrmBusiness already verified `ownerId` upstream.
  const crm = (req as any).crm;
  if (crm?.businessId) return crm.businessId as string;
  if (crm?.serviceBusinessId) {
    // Enrolled but never linked to a platform Business. Resolve it properly rather than
    // reporting "no business", which would send the caller to setup they already did.
    const linked = await prisma.crmServiceBusiness.findUnique({
      where: { id: crm.serviceBusinessId as string },
      select: { businessId: true },
    });
    return linked?.businessId ?? null;
  }

  // 2. An explicitly supplied service business id — OWNERSHIP-CHECKED, not trusted.
  //    This is the only caller-influenced input, and it is checked against ownerId so it
  //    cannot be used to point at someone else's tenant.
  const explicit = opts.serviceBusinessId;
  if (explicit) {
    const owned = await prisma.crmServiceBusiness.findFirst({
      where: { id: explicit, ownerId: userId },
      select: { id: true, businessId: true },
    });
    if (!owned) {
      logger.warn(`[Tenant] refused serviceBusinessId ${explicit} for user ${userId}: not owned`);
      throw new CustomError('That business is not associated with your account', 403);
    }
    return owned.businessId ?? null;
  }

  // 3. The verified token. Populated for anyone who completed Contact OS setup, because
  //    /crm/enroll reissues the token with the business id.
  const fromToken = (req as any).user?.businessId;
  if (typeof fromToken === 'string' && fromToken) return fromToken;

  return null;
}

/**
 * Middleware form: resolve the tenant once, attach it, and hand off.
 *
 * Attaching it matters as much as resolving it. Handlers that re-derive a business id
 * from `req.body` are how the SMS router ended up billing a caller-supplied tenant, and
 * how nine call sites ended up reading a JWT claim that enrollment had not set yet.
 * With `req.tenant` populated by a gate, the handler has nothing left to get wrong.
 */
export function attachTenant(opts: { serviceBusinessId?: string | null } = {}) {
  return async (req: Request, _res: unknown, next: (err?: unknown) => void) => {
    try {
      (req as any).tenant = await resolveTenant(req, opts);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Read an already-attached tenant. Throws rather than returning null. */
export function requireTenant(req: Request): Tenant {
  const tenant = (req as any).tenant as Tenant | undefined;
  if (!tenant) {
    throw new CustomError(
      'Tenant not resolved — is attachTenant() registered on this route?',
      500,
    );
  }
  return tenant;
}

/**
 * The platform business id, or a clear refusal.
 *
 * For routes writing `Invoice` or `SMSLog`, where a null `businessId` would otherwise
 * become a Prisma error at the worst possible moment.
 */
export function requirePlatformBusinessId(req: Request): string {
  const tenant = requireTenant(req);
  if (!tenant.businessId) {
    throw new CustomError(
      'This action needs a linked platform business. Complete business setup and try again.',
      409,
    );
  }
  return tenant.businessId;
}
