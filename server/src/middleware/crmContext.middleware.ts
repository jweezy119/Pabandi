import { AuthRequest } from './auth.middleware';
import { prisma } from '../utils/database';
import { CustomError } from './errorHandler';

/**
 * Resolved business context for a CRM request.
 *
 * The CRM is a *view* over a platform business, not a silo: `serviceBusinessId`
 * scopes operational records (jobs, clients, payroll) while `businessId` points
 * at the platform `Business` that other layers — booking, capital, property —
 * already key off. Every cross-layer join in the unified platform goes through
 * `businessId`; everything CRM-native goes through `serviceBusinessId`.
 */
export interface CrmContext {
  userId: string;
  serviceBusinessId: string;
  businessId: string | null;
}

/**
 * Resolve the caller's CRM business onto `req.crm`.
 *
 * Resolution order:
 *   1. an explicit `businessId` (query or body) — used by admins, by the public
 *      invoice surface, and by tests;
 *   2. the caller's `CrmServiceBusiness` row, either by its platform `businessId`
 *      or by `ownerId`.
 *
 * Failing this check means the caller has no business enrolled, which is a 403
 * rather than a 404 — the endpoint exists, the caller just isn't provisioned.
 */
export const resolveCrmBusiness = async (
  req: AuthRequest,
  _res: unknown,
  next: (err?: unknown) => void
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new CustomError('Authentication required', 401));
    }

    const requested = req.body?.businessId || req.query?.businessId;

    let crmBusiness = null as {
      id: string;
      businessId: string | null;
      ownerId: string;
    } | null;

    if (requested) {
      // Explicit target. Scoped to the caller's own businesses so a leaked
      // businessId in a query string cannot be used to read someone else's P&L.
      crmBusiness = await prisma.crmServiceBusiness.findFirst({
        where: {
          OR: [{ businessId: requested }, { id: requested }],
          ownerId: userId,
        },
        select: { id: true, businessId: true, ownerId: true },
      });
    } else {
      crmBusiness = await prisma.crmServiceBusiness.findFirst({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, businessId: true, ownerId: true },
      });
    }

    if (!crmBusiness) {
      return next(
        new CustomError('No service business enrolled for this account', 403)
      );
    }

    req.crm = {
      userId,
      serviceBusinessId: crmBusiness.id,
      businessId: crmBusiness.businessId,
    };
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Read the resolved context from a request that has passed through
 * `resolveCrmBusiness`. Throws rather than returning undefined so a missing
 * middleware registration surfaces as a loud 500 instead of a null-deref.
 */
export function requireCrmContext(req: AuthRequest): CrmContext {
  if (!req.crm) {
    throw new CustomError(
      'Business context not resolved — is resolveCrmBusiness registered on this route?',
      500
    );
  }
  return req.crm;
}