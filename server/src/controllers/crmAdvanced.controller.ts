import { Request, Response } from 'express';
import { crmAutomationService } from '../services/crmAutomation.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import {
  requirePropertyScope,
  ownedPropertyIds,
  isPropertyOwned,
  requireOwnedTenant,
  requireAdmin,
} from '../services/propertyScope';

/**
 * Property CRM endpoints.
 *
 * SCOPING IS LOAD-BEARING HERE
 * Every handler in this file used to answer for the whole platform: it read
 * `req.user` only to reject anonymous callers, never to decide which landlord's
 * data to return. `getOverdueRent` returned every landlord's unpaid rent,
 * `getExpiringLeases` every landlord's leases, and the two financial endpoints
 * would build a statement for any property id the caller typed.
 *
 * Four endpoints were worse. `generateMonthlyRent`, `applyLateFees`,
 * `checkLeaseExpirations` and `runAutomations` iterate every schedule on the
 * platform and WRITE, so any signed-in account could create rent charges and
 * late fees against every other landlord's tenants. Those are batch jobs; they
 * now require ADMIN (see propertyScope.requireAdmin).
 *
 * The remaining handlers take their landlord's ids from propertyScope and filter
 * on them. A landlord with no properties gets an empty list, which is the truth,
 * rather than another landlord's rows.
 *
 * The shared prisma from utils/database replaces a second PrismaClient that this
 * file was constructing: the app keeps one pool, and a second one silently
 * doubled the connection count against the RDS instance.
 */

/** Send the error as the status it deserves instead of flattening it to 500. */
function fail(res: Response, e: unknown) {
  if (e instanceof CustomError) {
    return res.status(e.statusCode).json({ error: e.message });
  }
  logger.error('[crm-advanced] request failed', e);
  return res.status(500).json({ error: 'Request failed' });
}

// ── Rent Routes ────────────────────────────────────────────────────────────────

export async function generateMonthlyRent(req: Request, res: Response) {
  try {
    requireAdmin(req as unknown as AuthRequest);
    const result = await crmAutomationService.generateMonthlyRent();
    res.json({ success: true, data: result });
  } catch (e) {
    fail(res, e);
  }
}

export async function getOverdueRent(req: Request, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req as unknown as AuthRequest);
    const propertyIds = await ownedPropertyIds(profileId);

    // RentPayment has no managerId; it reaches its landlord through propertyId.
    const overdue = await prisma.rentPayment.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['PENDING', 'LATE'] },
        dueDate: { lt: new Date() },
      },
      include: { property: true, unit: true },
      orderBy: { dueDate: 'asc' },
    });
    res.json({ success: true, data: overdue });
  } catch (e) {
    fail(res, e);
  }
}

export async function applyLateFees(req: Request, res: Response) {
  try {
    requireAdmin(req as unknown as AuthRequest);
    const result = await crmAutomationService.applyLateFees();
    res.json({ success: true, data: result });
  } catch (e) {
    fail(res, e);
  }
}

// ── Lease Routes ───────────────────────────────────────────────────────────────

export async function getExpiringLeases(req: Request, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req as unknown as AuthRequest);
    const days = parseInt(req.query.days as string) || 30;
    const now = new Date();
    const target = new Date(now);
    target.setDate(target.getDate() + days);

    const leases = await prisma.propertyLease.findMany({
      where: {
        managerId: profileId,
        status: 'ACTIVE',
        endDate: { lte: target, gte: now },
      },
      include: { property: true },
      orderBy: { endDate: 'asc' },
    });
    res.json({ success: true, data: leases });
  } catch (e) {
    fail(res, e);
  }
}

export async function renewLease(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);

    // findFirst with the owner in the predicate, not findUnique followed by a
    // check: the previous shape read the row first, so the lease was in memory
    // before anything decided whether this caller was allowed to see it.
    const lease = await prisma.propertyLease.findFirst({
      where: { id: req.params.id, managerId: profileId },
    });
    if (!lease) return res.status(404).json({ error: 'Lease not found' });

    const renewed = await prisma.propertyLease.update({
      where: { id: lease.id },
      data: {
        endDate: new Date(new Date(lease.endDate).setFullYear(new Date(lease.endDate).getFullYear() + 1)),
        status: 'ACTIVE',
        notes: `${lease.notes || ''}\nRenewed on ${new Date().toISOString()}`,
      },
    });
    res.json({ success: true, data: renewed });
  } catch (e) {
    fail(res, e);
  }
}

// ── Inspection Routes ──────────────────────────────────────────────────────────

export async function createInspection(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);
    const propertyIds = await ownedPropertyIds(profileId);

    const { unitId, tenantId, type, inspectorName, overallCondition, notes, items } = req.body;

    // An inspection is scoped by the unit it is about, or the tenant. Reject
    // rather than create: a report attached to somebody else's unit is worse than
    // a failed request, because it is invisible in their dashboard and real in
    // the database.
    if (unitId) {
      const unit = await prisma.propertyUnit.findFirst({
        where: { id: unitId, propertyId: { in: propertyIds } },
        select: { id: true },
      });
      if (!unit) return res.status(404).json({ error: 'Unit not found' });
    } else if (tenantId) {
      await requireOwnedTenant(req, tenantId);
    } else {
      return res.status(400).json({ error: 'A unitId or tenantId is required' });
    }

    const report = await prisma.inspectionReport.create({
      data: {
        unitId: unitId || null,
        tenantId: tenantId || null,
        type: type || 'ROUTINE',
        inspectorName,
        overallCondition: overallCondition || 'GOOD',
        notes,
        items: items ? { create: items } : undefined,
      },
      include: { items: true },
    });
    res.status(201).json({ success: true, data: report });
  } catch (e) {
    fail(res, e);
  }
}

export async function getInspection(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);
    const propertyIds = await ownedPropertyIds(profileId);

    const report = await prisma.inspectionReport.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { unit: { propertyId: { in: propertyIds } } },
          { tenant: { managerId: profileId } },
        ],
      },
      include: { items: true, unit: true, tenant: true },
    });
    if (!report) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: report });
  } catch (e) {
    fail(res, e);
  }
}

export async function signInspection(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);
    const propertyIds = await ownedPropertyIds(profileId);

    const report = await prisma.inspectionReport.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { unit: { propertyId: { in: propertyIds } } },
          { tenant: { managerId: profileId } },
        ],
      },
    });
    if (!report) return res.status(404).json({ error: 'Not found' });

    const { signedBy } = req.body; // 'tenant' | 'landlord'
    const updateData: any = {};
    if (signedBy === 'tenant') {
      updateData.tenantSigned = true;
      updateData.tenantSignedAt = new Date();
    } else if (signedBy === 'landlord') {
      updateData.landlordSigned = true;
      updateData.landlordSignedAt = new Date();
    } else {
      return res.status(400).json({ error: "signedBy must be 'tenant' or 'landlord'" });
    }

    const updated = await prisma.inspectionReport.update({
      where: { id: report.id },
      data: updateData,
    });
    res.json({ success: true, data: updated });
  } catch (e) {
    fail(res, e);
  }
}

// ── Maintenance Routes ─────────────────────────────────────────────────────────

export async function autoAssignVendor(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);
    const maintenance = await prisma.propertyMaintenance.findFirst({
      where: { id: req.params.id, managerId: profileId },
      select: { id: true },
    });
    if (!maintenance) return res.status(404).json({ error: 'Maintenance request not found' });

    const result = await crmAutomationService.autoAssignVendor(req.params.id);
    if (!result) return res.status(404).json({ error: 'Could not assign vendor' });
    res.json({ success: true, data: result });
  } catch (e) {
    fail(res, e);
  }
}

export async function listVendors(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);
    const vendors = await prisma.maintenanceVendor.findMany({
      where: { managerId: profileId },
      orderBy: { rating: 'desc' },
    });
    res.json({ success: true, data: vendors });
  } catch (e) {
    fail(res, e);
  }
}

export async function addVendor(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);

    const { name, company, phone, email, specialties } = req.body;
    if (!name) return res.status(400).json({ error: 'A vendor name is required' });

    const vendor = await prisma.maintenanceVendor.create({
      data: {
        managerId: profileId,
        name,
        company,
        phone,
        email,
        specialties: specialties || [],
      },
    });
    res.status(201).json({ success: true, data: vendor });
  } catch (e) {
    fail(res, e);
  }
}

// ── Financial Routes ───────────────────────────────────────────────────────────

export async function getPropertyFinancials(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);
    const { propertyId } = req.params;

    if (!(await isPropertyOwned(profileId, propertyId))) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const startDate = req.query.start ? new Date(req.query.start as string) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end ? new Date(req.query.end as string) : new Date();

    const result = await crmAutomationService.generatePropertyFinancials(propertyId, startDate, endDate);
    res.json({ success: true, data: result });
  } catch (e) {
    fail(res, e);
  }
}

export async function getCashFlowForecast(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);
    const { propertyId } = req.params;

    if (!(await isPropertyOwned(profileId, propertyId))) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const months = parseInt(req.query.months as string) || 12;
    const result = await crmAutomationService.generateCashFlowForecast(propertyId, months);
    res.json({ success: true, data: result });
  } catch (e) {
    fail(res, e);
  }
}

// ── Tenant Routes ──────────────────────────────────────────────────────────────

export async function getTenantRisk(req: any, res: Response) {
  try {
    await requireOwnedTenant(req, req.params.tenantId);
    const result = await crmAutomationService.calculateTenantRiskScore(req.params.tenantId);
    res.json({ success: true, data: result });
  } catch (e) {
    fail(res, e);
  }
}

export async function getTenantLedger(req: any, res: Response) {
  try {
    await requireOwnedTenant(req, req.params.tenantId);
    const ledger = await prisma.tenantLedger.findMany({
      where: { tenantId: req.params.tenantId },
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, data: ledger });
  } catch (e) {
    fail(res, e);
  }
}

// ── Automation Routes ──────────────────────────────────────────────────────────

export async function createAutomation(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);

    const { name, trigger, condition, action, actionData } = req.body;
    if (!name || !trigger || !action) {
      return res.status(400).json({ error: 'name, trigger and action are required' });
    }

    const rule = await prisma.automationRule.create({
      data: { managerId: profileId, name, trigger, condition, action, actionData },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (e) {
    fail(res, e);
  }
}

export async function listAutomations(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);
    const rules = await prisma.automationRule.findMany({
      where: { managerId: profileId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: rules });
  } catch (e) {
    fail(res, e);
  }
}

export async function triggerAutomation(req: any, res: Response) {
  try {
    const { profileId } = await requirePropertyScope(req);
    const rule = await prisma.automationRule.findFirst({
      where: { id: req.params.id, managerId: profileId },
    });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    // TODO: this records that the rule fired but does not execute its action. That
    // is left as-is deliberately — running an arbitrary stored action is a
    // separate piece of work and silently pretending it happened would be worse.

    const updated = await prisma.automationRule.update({
      where: { id: rule.id },
      data: { lastTriggered: new Date(), triggerCount: { increment: 1 } },
    });
    res.json({ success: true, data: { rule: updated, triggered: true } });
  } catch (e) {
    fail(res, e);
  }
}

export async function runAutomations(req: Request, res: Response) {
  try {
    requireAdmin(req as unknown as AuthRequest);
    const rentResult = await crmAutomationService.generateMonthlyRent();
    const lateFeeResult = await crmAutomationService.applyLateFees();
    const leaseResult = await crmAutomationService.checkLeaseExpirations();

    res.json({
      success: true,
      data: {
        rentGeneration: rentResult,
        lateFees: lateFeeResult,
        leaseExpirations: leaseResult,
      },
    });
  } catch (e) {
    fail(res, e);
  }
}