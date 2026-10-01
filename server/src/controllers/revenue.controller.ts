import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { getActiveAlerts, dismissAlert } from '../services/alerts.service';
import { updateClientScore, refreshClientTrust, getClientStage } from '../services/crm-reliability.service';

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
 * Also note the indirection below: these handlers look the tenant up in
 * CrmBusiness (the service-business record, keyed by ownerEmail) rather than
 * using businessId directly, because alerts.service and crm-reliability.service
 * are written against CrmBusiness ids. That is a second id space from the
 * Business.id the token carries, which is itself worth untangling, but the
 * ownership check is what prevents a cross-tenant read.
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
 * Resolve the CrmBusiness row for the caller's tenant.
 *
 * WHY THIS LOOKS UP BY EMAIL
 * CrmBusiness has no `businessId` column — it is a separate id space from
 * Business, and the only thing joining them is ownerEmail (crm.service.ts
 * creates both from the same owner). The original code did
 * `crmBusiness.findUnique({ where: { businessId } })`, which Prisma rejects
 * because CrmBusiness has no such field: these three endpoints were throwing a
 * validation error and 500ing on every call. They were never working, so this
 * is a fix rather than a hardening.
 *
 * Email is a weak join and is worth replacing with an explicit relation. That is
 * a schema migration, not a hotfix, so it is flagged rather than done here.
 */
async function requireCrmBusiness(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { email: true },
  });
  if (!business?.email) {
    throw new CustomError('No CRM business is associated with this account', 404);
  }

  const crmBusiness = await prisma.crmBusiness.findFirst({ where: { ownerEmail: business.email } });
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
      where: { id: clientId, businessId: crmBusiness.id },
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
