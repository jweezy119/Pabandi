"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyRent = generateMonthlyRent;
exports.getOverdueRent = getOverdueRent;
exports.applyLateFees = applyLateFees;
exports.getExpiringLeases = getExpiringLeases;
exports.renewLease = renewLease;
exports.createInspection = createInspection;
exports.getInspection = getInspection;
exports.signInspection = signInspection;
exports.autoAssignVendor = autoAssignVendor;
exports.listVendors = listVendors;
exports.addVendor = addVendor;
exports.getPropertyFinancials = getPropertyFinancials;
exports.getCashFlowForecast = getCashFlowForecast;
exports.getTenantRisk = getTenantRisk;
exports.getTenantLedger = getTenantLedger;
exports.createAutomation = createAutomation;
exports.listAutomations = listAutomations;
exports.triggerAutomation = triggerAutomation;
exports.runAutomations = runAutomations;
const client_1 = require("@prisma/client");
const crmAutomation_service_1 = require("../services/crmAutomation.service");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
// ── Rent Routes ────────────────────────────────────────────────────────────────
async function generateMonthlyRent(req, res) {
    try {
        const result = await crmAutomation_service_1.crmAutomationService.generateMonthlyRent();
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function getOverdueRent(req, res) {
    try {
        const now = new Date();
        const overdue = await prisma.rentPayment.findMany({
            where: { status: { in: ['PENDING', 'LATE'] }, dueDate: { lt: now } },
            include: { property: true, unit: true },
            orderBy: { dueDate: 'asc' },
        });
        res.json({ success: true, data: overdue });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function applyLateFees(req, res) {
    try {
        const result = await crmAutomation_service_1.crmAutomationService.applyLateFees();
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
// ── Lease Routes ───────────────────────────────────────────────────────────────
async function getExpiringLeases(req, res) {
    try {
        const days = parseInt(req.query.days) || 30;
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function renewLease(req, res) {
    try {
        const lease = await prisma.propertyLease.findUnique({ where: { id: req.params.id } });
        if (!lease)
            return res.status(404).json({ error: 'Lease not found' });
        const renewed = await prisma.propertyLease.update({
            where: { id: lease.id },
            data: {
                endDate: new Date(lease.endDate.setFullYear(lease.endDate.getFullYear() + 1)),
                status: 'ACTIVE',
                notes: `${lease.notes || ''}\nRenewed on ${new Date().toISOString()}`,
            },
        });
        res.json({ success: true, data: renewed });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
// ── Inspection Routes ──────────────────────────────────────────────────────────
async function createInspection(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
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
    }
    catch (e) {
        logger_1.logger.error('[crm] create inspection failed', e);
        res.status(500).json({ error: 'Could not create inspection' });
    }
}
async function getInspection(req, res) {
    try {
        const report = await prisma.inspectionReport.findUnique({
            where: { id: req.params.id },
            include: { items: true, unit: true, tenant: true },
        });
        if (!report)
            return res.status(404).json({ error: 'Not found' });
        res.json({ success: true, data: report });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function signInspection(req, res) {
    try {
        const report = await prisma.inspectionReport.findUnique({ where: { id: req.params.id } });
        if (!report)
            return res.status(404).json({ error: 'Not found' });
        const { signedBy } = req.body; // 'tenant' | 'landlord'
        const updateData = {};
        if (signedBy === 'tenant') {
            updateData.tenantSigned = true;
            updateData.tenantSignedAt = new Date();
        }
        else if (signedBy === 'landlord') {
            updateData.landlordSigned = true;
            updateData.landlordSignedAt = new Date();
        }
        const updated = await prisma.inspectionReport.update({
            where: { id: report.id },
            data: updateData,
        });
        res.json({ success: true, data: updated });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
// ── Maintenance Routes ─────────────────────────────────────────────────────────
async function autoAssignVendor(req, res) {
    try {
        const result = await crmAutomation_service_1.crmAutomationService.autoAssignVendor(req.params.id);
        if (!result)
            return res.status(404).json({ error: 'Could not assign vendor' });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function listVendors(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
        const vendors = await prisma.maintenanceVendor.findMany({
            where: { managerId: profile.id },
            orderBy: { rating: 'desc' },
        });
        res.json({ success: true, data: vendors });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function addVendor(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
// ── Financial Routes ───────────────────────────────────────────────────────────
async function getPropertyFinancials(req, res) {
    try {
        const { propertyId } = req.params;
        const startDate = req.query.start ? new Date(req.query.start) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const endDate = req.query.end ? new Date(req.query.end) : new Date();
        const result = await crmAutomation_service_1.crmAutomationService.generatePropertyFinancials(propertyId, startDate, endDate);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function getCashFlowForecast(req, res) {
    try {
        const { propertyId } = req.params;
        const months = parseInt(req.query.months) || 12;
        const result = await crmAutomation_service_1.crmAutomationService.generateCashFlowForecast(propertyId, months);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
// ── Tenant Routes ──────────────────────────────────────────────────────────────
async function getTenantRisk(req, res) {
    try {
        const result = await crmAutomation_service_1.crmAutomationService.calculateTenantRiskScore(req.params.tenantId);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function getTenantLedger(req, res) {
    try {
        const ledger = await prisma.tenantLedger.findMany({
            where: { tenantId: req.params.tenantId },
            orderBy: { date: 'desc' },
        });
        res.json({ success: true, data: ledger });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
// ── Automation Routes ──────────────────────────────────────────────────────────
async function createAutomation(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function listAutomations(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
        const rules = await prisma.automationRule.findMany({
            where: { managerId: profile.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: rules });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function triggerAutomation(req, res) {
    try {
        const rule = await prisma.automationRule.findUnique({ where: { id: req.params.id } });
        if (!rule)
            return res.status(404).json({ error: 'Rule not found' });
        // Execute the action based on rule type
        const updated = await prisma.automationRule.update({
            where: { id: rule.id },
            data: { lastTriggered: new Date(), triggerCount: { increment: 1 } },
        });
        res.json({ success: true, data: { rule: updated, triggered: true } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
async function runAutomations(req, res) {
    try {
        const rentResult = await crmAutomation_service_1.crmAutomationService.generateMonthlyRent();
        const lateFeeResult = await crmAutomation_service_1.crmAutomationService.applyLateFees();
        const leaseResult = await crmAutomation_service_1.crmAutomationService.checkLeaseExpirations();
        res.json({
            success: true,
            data: {
                rentGeneration: rentResult,
                lateFees: lateFeeResult,
                leaseExpirations: leaseResult,
            },
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
//# sourceMappingURL=crmAdvanced.controller.js.map