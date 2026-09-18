import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { crmAutomationService } from '../services/crmAutomation.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ── Rent Routes ────────────────────────────────────────────────────────────────

export async function generateMonthlyRent(req: Request, res: Response) {
  try {
    const result = await crmAutomationService.generateMonthlyRent();
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function getOverdueRent(req: Request, res: Response) {
  try {
    const now = new Date();
    const overdue = await prisma.rentPayment.findMany({
      where: { status: { in: ['PENDING', 'LATE'] }, dueDate: { lt: now } },
      include: { property: true, unit: true },
      orderBy: { dueDate: 'asc' },
    });
    res.json({ success: true, data: overdue });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function applyLateFees(req: Request, res: Response) {
  try {
    const result = await crmAutomationService.applyLateFees();
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// ── Lease Routes ───────────────────────────────────────────────────────────────

export async function getExpiringLeases(req: Request, res: Response) {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const now = new Date();
    const target = new Date(now);
    target.setDate(target.getDate() + days);

    const leases = await prisma.propertyLease.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: target, gte: now },
      },
      include: { property: true },
      orderBy: { endDate: 'asc' },
    });
    res.json({ success: true, data: leases });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function renewLease(req: Request, res: Response) {
  try {
    const lease = await prisma.propertyLease.findUnique({ where: { id: req.params.id } });
    if (!lease) return res.status(404).json({ error: 'Lease not found' });

    const renewed = await prisma.propertyLease.update({
      where: { id: lease.id },
      data: {
        endDate: new Date(lease.endDate.setFullYear(lease.endDate.getFullYear() + 1)),
        status: 'ACTIVE',
        notes: `${lease.notes || ''}\nRenewed on ${new Date().toISOString()}`,
      },
    });
    res.json({ success: true, data: renewed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// ── Inspection Routes ──────────────────────────────────────────────────────────

export async function createInspection(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { unitId, tenantId, type, inspectorName, overallCondition, notes, items } = req.body;
    const report = await prisma.inspectionReport.create({
      data: {
        unitId,
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
  } catch (e: any) {
    logger.error('[crm] create inspection failed', e);
    res.status(500).json({ error: 'Could not create inspection' });
  }
}

export async function getInspection(req: any, res: Response) {
  try {
    const report = await prisma.inspectionReport.findUnique({
      where: { id: req.params.id },
      include: { items: true, unit: true, tenant: true },
    });
    if (!report) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: report });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function signInspection(req: any, res: Response) {
  try {
    const report = await prisma.inspectionReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Not found' });

    const { signedBy } = req.body; // 'tenant' | 'landlord'
    const updateData: any = {};
    if (signedBy === 'tenant') {
      updateData.tenantSigned = true;
      updateData.tenantSignedAt = new Date();
    } else if (signedBy === 'landlord') {
      updateData.landlordSigned = true;
      updateData.landlordSignedAt = new Date();
    }

    const updated = await prisma.inspectionReport.update({
      where: { id: report.id },
      data: updateData,
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// ── Maintenance Routes ─────────────────────────────────────────────────────────

export async function autoAssignVendor(req: any, res: Response) {
  try {
    const result = await crmAutomationService.autoAssignVendor(req.params.id);
    if (!result) return res.status(404).json({ error: 'Could not assign vendor' });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function listVendors(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const vendors = await prisma.maintenanceVendor.findMany({
      where: { managerId: profile.id },
      orderBy: { rating: 'desc' },
    });
    res.json({ success: true, data: vendors });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function addVendor(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { name, company, phone, email, specialties } = req.body;
    const vendor = await prisma.maintenanceVendor.create({
      data: {
        managerId: profile.id,
        name,
        company,
        phone,
        email,
        specialties: specialties || [],
      },
    });
    res.status(201).json({ success: true, data: vendor });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// ── Financial Routes ───────────────────────────────────────────────────────────

export async function getPropertyFinancials(req: any, res: Response) {
  try {
    const { propertyId } = req.params;
    const startDate = req.query.start ? new Date(req.query.start as string) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end ? new Date(req.query.end as string) : new Date();

    const result = await crmAutomationService.generatePropertyFinancials(propertyId, startDate, endDate);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function getCashFlowForecast(req: any, res: Response) {
  try {
    const { propertyId } = req.params;
    const months = parseInt(req.query.months as string) || 12;
    const result = await crmAutomationService.generateCashFlowForecast(propertyId, months);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// ── Tenant Routes ──────────────────────────────────────────────────────────────

export async function getTenantRisk(req: any, res: Response) {
  try {
    const result = await crmAutomationService.calculateTenantRiskScore(req.params.tenantId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function getTenantLedger(req: any, res: Response) {
  try {
    const ledger = await prisma.tenantLedger.findMany({
      where: { tenantId: req.params.tenantId },
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, data: ledger });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// ── Automation Routes ──────────────────────────────────────────────────────────

export async function createAutomation(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { name, trigger, condition, action, actionData } = req.body;
    const rule = await prisma.automationRule.create({
      data: {
        managerId: profile.id,
        name,
        trigger,
        condition,
        action,
        actionData,
      },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function listAutomations(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const rules = await prisma.automationRule.findMany({
      where: { managerId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: rules });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function triggerAutomation(req: any, res: Response) {
  try {
    const rule = await prisma.automationRule.findUnique({ where: { id: req.params.id } });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    // Execute the action based on rule type
    const updated = await prisma.automationRule.update({
      where: { id: rule.id },
      data: { lastTriggered: new Date(), triggerCount: { increment: 1 } },
    });

    res.json({ success: true, data: { rule: updated, triggered: true } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function runAutomations(req: any, res: Response) {
  try {
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
