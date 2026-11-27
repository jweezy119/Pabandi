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
  platformBusinessId?: string;
  isOwner?: boolean;
  role?: string;
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

    const biz = requested
      ? await prisma.business.findFirst({
          where: { id: requested, ownerId: userId },
          select: { id: true, ownerId: true },
        })
      : await prisma.business.findFirst({
          where: { ownerId: userId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, ownerId: true },
        });

    if (!biz) {
      return next(
        new CustomError('No service business enrolled for this account', 403)
      );
    }

    req.crm = {
      userId,
      serviceBusinessId: biz.id,
      platformBusinessId: biz.id,
      // Real role from the session, not a hardcoded owner flag. Route-level
      // checks can now distinguish an owner from an employee/agent.
      isOwner: biz.ownerId === userId,
      role: req.user?.role ?? 'CUSTOMER',
      businessId: biz.id,
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