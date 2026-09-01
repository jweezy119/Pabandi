import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

// All routes require auth.
router.use(authenticate);

// ── Units ──────────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/units — add a unit to a property.
router.post('/units', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { propertyId, unitNumber, bedrooms, bathrooms, sqft, rentAmount, depositAmount, status, notes } = req.body || {};
    if (!propertyId || !unitNumber) return res.status(400).json({ error: 'propertyId and unitNumber are required' });

    // Validate property belongs to this manager.
    const property = await prisma.propertyManagerProperty.findFirst({ where: { id: propertyId, managerId: profile.id } });
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const unit = await prisma.propertyUnit.create({
      data: {
        propertyId,
        unitNumber,
        bedrooms: bedrooms || 1,
        bathrooms: bathrooms || 1,
        sqft: sqft || null,
        rentAmount: rentAmount != null ? Number(rentAmount) : null,
        depositAmount: depositAmount != null ? Number(depositAmount) : 0,
        status: status || 'VACANT',
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: unit });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not add unit' });
  }
});

// GET /api/v1/property-manager/units?propertyId=ID — list units for a property.
router.get('/units', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { propertyId } = req.query;
    const units = await prisma.propertyUnit.findMany({
      where: { propertyId: propertyId as string, property: { managerId: profile.id } },
      orderBy: { unitNumber: 'asc' },
    });
    res.json({ success: true, data: units });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/property-manager/units/:id — update a unit.
router.patch('/units/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { status, rentAmount, depositAmount, notes } = req.body || {};
    const unit = await prisma.propertyUnit.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(rentAmount != null && { rentAmount: Number(rentAmount) }),
        ...(depositAmount != null && { depositAmount: Number(depositAmount) }),
        ...(notes !== undefined && { notes }),
      },
    });
    res.json({ success: true, data: unit });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update unit' });
  }
});

// ── Rent Payments ──────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/rent-payments — record a rent payment.
router.post('/rent-payments', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { propertyId, unitId, tenantEmail, amount, dueDate, paidAt, status, method, reference, notes } = req.body || {};
    if (!propertyId || !tenantEmail || !amount || !dueDate) return res.status(400).json({ error: 'propertyId, tenantEmail, amount, dueDate are required' });

    const payment = await prisma.rentPayment.create({
      data: {
        propertyId,
        unitId: unitId || null,
        tenantEmail: String(tenantEmail).toLowerCase().trim(),
        amount: Number(amount),
        dueDate: new Date(dueDate),
        paidAt: paidAt ? new Date(paidAt) : null,
        status: status || 'PENDING',
        method: method || null,
        reference: reference || null,
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: payment });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not record payment' });
  }
});

// GET /api/v1/property-manager/rent-payments?propertyId=ID — list rent payments.
router.get('/rent-payments', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { propertyId, status: statusFilter } = req.query;
    const payments = await prisma.rentPayment.findMany({
      where: {
        propertyId: propertyId as string,
        ...(statusFilter && { status: statusFilter as string }),
      },
      orderBy: { dueDate: 'desc' },
    });
    res.json({ success: true, data: payments });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/property-manager/rent-payments/:id — update payment status.
router.patch('/rent-payments/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { status, paidAt, method, reference, notes } = req.body || {};
    const payment = await prisma.rentPayment.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(paidAt && { paidAt: new Date(paidAt) }),
        ...(method && { method }),
        ...(reference && { reference }),
        ...(notes !== undefined && { notes }),
      },
    });
    res.json({ success: true, data: payment });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update payment' });
  }
});

// ── Inspections ────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/inspections — create an inspection report.
router.post('/inspections', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { propertyId, unitId, inspector, condition, notes, findings } = req.body || {};
    if (!propertyId) return res.status(400).json({ error: 'propertyId is required' });

    const inspection = await prisma.propertyInspection.create({
      data: {
        propertyId,
        unitId: unitId || null,
        inspector: inspector || null,
        condition: condition || 'GOOD',
        notes: notes || null,
        findings: findings || null,
      },
    });
    res.status(201).json({ success: true, data: inspection });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create inspection' });
  }
});

// GET /api/v1/property-manager/inspections?propertyId=ID — list inspections.
router.get('/inspections', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { propertyId } = req.query;
    const inspections = await prisma.propertyInspection.findMany({
      where: { propertyId: propertyId as string },
      orderBy: { inspectedAt: 'desc' },
    });
    res.json({ success: true, data: inspections });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Financials ────────────────────────────────────────────────────────────────

// POST /api/v1/property/financials — record income or expense.
router.post('/financials', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { propertyId, unitId, type, category, amount, description, tenantEmail, date } = req.body || {};
    if (!propertyId || !type || !category || !amount) return res.status(400).json({ error: 'propertyId, type, category, amount are required' });

    const financial = await prisma.propertyFinancial.create({
      data: {
        propertyId,
        unitId: unitId || null,
        type,
        category,
        amount: Number(amount),
        description: description || null,
        tenantEmail: tenantEmail ? String(tenantEmail).toLowerCase().trim() : null,
        date: date ? new Date(date) : new Date(),
      },
    });
    res.status(201).json({ success: true, data: financial });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not record financial' });
  }
});

// GET /api/v1/property/financials?propertyId=ID — list financials.
router.get('/financials', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { propertyId, type: typeFilter } = req.query;
    const financials = await prisma.propertyFinancial.findMany({
      where: { propertyId: propertyId as string, ...(typeFilter && { type: typeFilter as string }) },
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, data: financials });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/property/financials/summary?propertyId=ID — financial summary.
router.get('/financials/summary', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { propertyId } = req.query;
    const financials = await prisma.propertyFinancial.findMany({
      where: { propertyId: propertyId as string },
    });

    const income = financials.filter((f) => f.type === 'INCOME').reduce((s, f) => s + f.amount, 0);
    const expenses = financials.filter((f) => f.type === 'EXPENSE').reduce((s, f) => s + f.amount, 0);
    const noi = income - expenses;

    res.json({ success: true, data: { income, expenses, noi, count: financials.length } });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
