import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { requireCrmContext } from '../middleware/crmContext.middleware';
import { prisma } from '../utils/database';
import { getActiveAlerts, dismissAlert } from '../services/alerts.service';
import { refreshClientTrust, getClientStage } from '../services/crm-reliability.service';

// ─── Tenant resolution ────────────────────────────────────────────────────────

/**
 * The tenant this request may act on.
 *
 * WHY NOT req.body/req.query.businessId
 * These three handlers were the last CRM endpoints still taking businessId
 * straight from the request. Any authenticated user could pass another tenant's
 * id and read their alerts, dismiss them, or read a client's stage and refresh
 * that client's trust score. getBusinessId in crm.routes.ts and
 * crm.controller.ts was already hardened; this is the same rule.
 *
 * The handlers below then resolve that id to a CrmServiceBusiness, because
 * alerts.service and crm-reliability.service are written against service-business
 * ids rather than platform Business ids. That is a second id space, and the
 * ownership check above is what prevents a cross-tenant read across it.
 */
function requireOwnBusinessId(req: AuthRequest): string {
  const tokenBusinessId = req.user?.businessId ?? req.user?.activeBusinessId;
  if (!tokenBusinessId) {
    throw new CustomError('No business is associated with this account', 403);
  }

  const requested = (req.body?.businessId || req.query?.businessId) as string | undefined;
  if (requested && requested !== tokenBusinessId) {
    throw new CustomError('Not allowed for this business', 403);
  }

  return tokenBusinessId;
}

/**
 * Resolve the CrmServiceBusiness row for the caller's tenant.
 *
 * ─── HISTORY, BECAUSE IT IS THE REASON THIS FUNCTION IS STRANGER THAN IT LOOKS ─
 *
 * This resolved a `CrmBusiness` row, which has no table:
 * `The table public.CrmBusiness does not exist in the current database`. All
 * three endpoints below returned 500 on every call, for their entire life.
 *
 * Before that it did `crmBusiness.findUnique({ where: { businessId } })`, which
 * Prisma rejects because CrmBusiness had no `businessId` field at all — so the
 * code was already non-functional, and someone "fixed" it by looking the row up
 * by `ownerEmail`. The comment at the time called that "a weak join ... worth
 * replacing with an explicit relation. That is a schema migration, not a
 * hotfix, so it is flagged rather than done here."
 *
 * This is that migration. `CrmServiceBusiness` has a real `businessId` column
 * with a foreign key to `Business`, so the email round-trip through the platform
 * business is gone and the lookup is the explicit relation the old comment asked
 * for.
 *
 * Returning `id` is now the CrmServiceBusiness primary key, which is what
 * `serviceBusinessId` on crmClient / crmJob / crmAlert references. Previously
 * callers passed this same value into a column called `businessId`, which was
 * correct only while CrmBusiness and CrmServiceBusiness were different tables.
 */
async function requireCrmBusiness(businessId: string) {
  const crmBusiness = await prisma.crmServiceBusiness.findFirst({
    where: { businessId },
  });
  if (!crmBusiness) {
    throw new CustomError('CRM business not found for this business', 404);
  }
  return crmBusiness;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function getAlertsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crmBusiness = await requireCrmBusiness(requireOwnBusinessId(req));
    const alerts = await getActiveAlerts(crmBusiness.id);
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
}

export async function dismissAlertHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: alertId } = req.params;
    const crmBusiness = await requireCrmBusiness(requireOwnBusinessId(req));
    const result = await dismissAlert(alertId, crmBusiness.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// ─── Client Stage ─────────────────────────────────────────────────────────────

export async function getClientStageHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: clientId } = req.params;
    const crmBusiness = await requireCrmBusiness(requireOwnBusinessId(req));

    const client = await prisma.crmClient.findFirst({
      where: { id: clientId, serviceBusinessId: crmBusiness.id },
      include: { jobs: true },
    });
    if (!client) {
      throw new CustomError('Client not found', 404);
    }

    // Refresh score + stage and return
    const result = await refreshClientTrust(clientId);
    res.json({
      success: true,
      data: {
        clientId: client.id,
        clientName: client.name,
        stage: result.stage,
        score: result.score,
      },
    });
  } catch (error) {
    next(error);
  }
}