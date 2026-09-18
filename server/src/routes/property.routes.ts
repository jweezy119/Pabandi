import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { rentAutomationService } from '../services/rentAutomation.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const router = Router();

// Configure multer for property photo uploads
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/properties');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

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

// ── Photos ──────────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/photos/upload — multipart file upload
router.post('/photos/upload', upload.single('photo'), async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const file = req.file as any;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const { propertyId, unitId, caption, sortOrder, isCover } = req.body || {};
    if (!propertyId) return res.status(400).json({ error: 'propertyId is required' });

    // Validate property belongs to this manager.
    const property = await prisma.propertyManagerProperty.findFirst({ where: { id: propertyId, managerId: profile.id } });
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const url = `/uploads/properties/${file.filename}`;
    const photo = await prisma.propertyPhoto.create({
      data: {
        propertyId,
        unitId: unitId || undefined,
        url,
        caption: caption || file.originalname,
        sortOrder: sortOrder ? Number(sortOrder) : 0,
        isCover: isCover === 'true',
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    });

    res.status(201).json({ success: true, data: photo });
  } catch (e: any) {
    console.error('[photos] upload failed:', e.message);
    res.status(500).json({ error: 'Could not upload photo' });
  }
});

// POST /api/v1/property-manager/photos
router.post('/photos', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId, url, caption, sortOrder, isCover, mimeType, fileSize } = req.body || {};
    if (!propertyId || !url) return res.status(400).json({ error: 'propertyId and url are required' });
    const photo = await prisma.propertyPhoto.create({ data: { propertyId, unitId, url, caption, sortOrder: sortOrder || 0, isCover: isCover || false, mimeType, fileSize } });
    res.status(201).json({ success: true, data: photo });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not upload photo' });
  }
});

// GET /api/v1/property-manager/photos?propertyId=ID&unitId=ID
router.get('/photos', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId } = req.query;
    const photos = await prisma.propertyPhoto.findMany({ where: { propertyId, unitId: unitId || undefined }, orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: photos });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/property-manager/photos/:id
router.delete('/photos/:id', async (req: any, res: Response) => {
  try {
    await prisma.propertyPhoto.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete photo' });
  }
});

// ── Amenities ──────────────────────────────────────────────────────────────────

// GET /api/v1/amenities — global amenity list
router.get('/amenities', async (_req: any, res: Response) => {
  try {
    const amenities = await prisma.amenity.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: amenities });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/property-manager/amenities
router.post('/amenities', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId, amenityId, value, notes } = req.body || {};
    if (!propertyId || !amenityId) return res.status(400).json({ error: 'propertyId and amenityId are required' });
    const pa = await prisma.propertyAmenity.create({ data: { propertyId, unitId, amenityId, value, notes } });
    res.status(201).json({ success: true, data: pa });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not add amenity' });
  }
});

// GET /api/v1/property-manager/amenities?propertyId=ID&unitId=ID
router.get('/amenities', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId } = req.query;
    const items = await prisma.propertyAmenity.findMany({ where: { propertyId, unitId: unitId || undefined }, include: { amenity: true } });
    res.json({ success: true, data: items });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Rate Plans ─────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/rate-plans
router.post('/rate-plans', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId, name, description, rentAmount, rentPeriod, currency, rules, isActive, minStayNights, maxStayNights } = req.body || {};
    if (!propertyId || !name || !rentAmount) return res.status(400).json({ error: 'propertyId, name, and rentAmount are required' });
    const plan = await prisma.propertyRatePlan.create({ data: { propertyId, unitId, name, description, rentAmount, rentPeriod: rentPeriod || 'MONTH', currency: currency || 'USD', rules, isActive: isActive ?? true, minStayNights, maxStayNights } });
    res.status(201).json({ success: true, data: plan });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create rate plan' });
  }
});

// GET /api/v1/property-manager/rate-plans?propertyId=ID&unitId=ID
router.get('/rate-plans', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId } = req.query;
    const plans = await prisma.propertyRatePlan.findMany({ where: { propertyId, unitId: unitId || undefined, isActive: true } });
    res.json({ success: true, data: plans });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Availability ───────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/availability
router.post('/availability', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId, date, status, rate, currency, minStay, maxStay, note } = req.body || {};
    if (!propertyId || !date) return res.status(400).json({ error: 'propertyId and date are required' });
    const avail = await prisma.propertyAvailability.upsert({
      where: { propertyId_unitId_date: { propertyId, unitId: unitId || '', date: new Date(date) } },
      update: { status: status || 'AVAILABLE', rate: rate != null ? Number(rate) : null, currency: currency || 'USD', minStay, maxStay, note, updatedAt: new Date() },
      create: { propertyId, unitId, date: new Date(date), status: status || 'AVAILABLE', rate: rate != null ? Number(rate) : null, currency: currency || 'USD', minStay, maxStay, note },
    });
    res.json({ success: true, data: avail });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update availability' });
  }
});

// GET /api/v1/property-manager/availability?propertyId=ID&unitId=ID&start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/availability', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId, start, end } = req.query;
    const where: any = { propertyId };
    if (unitId) where.unitId = unitId;
    if (start && end) {
      where.date = { gte: new Date(start as string), lte: new Date(end as string) };
    }
    const items = await prisma.propertyAvailability.findMany({ where, orderBy: { date: 'asc' } });
    res.json({ success: true, data: items });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reviews ────────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/reviews
router.post('/reviews', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId, reviewerId, reviewerName, reviewerEmail, rating, title, comment, stayStartDate, stayEndDate, source } = req.body || {};
    if (!propertyId || !rating) return res.status(400).json({ error: 'propertyId and rating are required' });
    const review = await prisma.propertyReview.create({ data: { propertyId, unitId, reviewerId, reviewerName, reviewerEmail, rating, title, comment, stayStartDate: stayStartDate ? new Date(stayStartDate) : null, stayEndDate: stayEndDate ? new Date(stayEndDate) : null, source: source || 'DIRECT' } });
    res.status(201).json({ success: true, data: review });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create review' });
  }
});

// GET /api/v1/property-manager/reviews?propertyId=ID&unitId=ID
router.get('/reviews', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId } = req.query;
    const reviews = await prisma.propertyReview.findMany({ where: { propertyId, unitId: unitId || undefined, isPublished: true }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: reviews });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Favorites ──────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/favorites
router.post('/favorites', async (req: any, res: Response) => {
  try {
    const { userId, propertyId, unitId, note } = req.body || {};
    if (!userId || !propertyId) return res.status(400).json({ error: 'userId and propertyId are required' });
    const fav = await prisma.propertyFavorite.create({ data: { userId, propertyId, unitId, note } });
    res.status(201).json({ success: true, data: fav });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not add favorite' });
  }
});

// GET /api/v1/property-manager/favorites?userId=ID
router.get('/favorites', async (req: any, res: Response) => {
  try {
    const { userId } = req.query;
    const favs = await prisma.propertyFavorite.findMany({ where: { userId: userId as string }, include: { property: true, unit: true } });
    res.json({ success: true, data: favs });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/property-manager/favorites/:id
router.delete('/favorites/:id', async (req: any, res: Response) => {
  try {
    await prisma.propertyFavorite.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not remove favorite' });
  }
});

// ── Messages ───────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/messages
router.post('/messages', async (req: any, res: Response) => {
  try {
    const { propertyId, unitId, conversationId, senderId, senderEmail, senderName, recipientId, recipientEmail, subject, body, mimeType, attachments } = req.body || {};
    if (!propertyId || !conversationId || !body) return res.status(400).json({ error: 'propertyId, conversationId, and body are required' });
    const msg = await prisma.propertyMessage.create({ data: { propertyId, unitId, conversationId, senderId, senderEmail, senderName, recipientId, recipientEmail, subject, body, mimeType: mimeType || 'text/plain', attachments } });
    res.status(201).json({ success: true, data: msg });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not send message' });
  }
});

// GET /api/v1/property-manager/messages?conversationId=ID
router.get('/messages', async (req: any, res: Response) => {
  try {
    const { conversationId } = req.query;
    const msgs = await prisma.propertyMessage.findMany({ where: { conversationId: conversationId as string }, orderBy: { createdAt: 'asc' } });
    res.json({ success: true, data: msgs });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Vendors ────────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/vendors
router.post('/vendors', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { name, email, phone, company, categories, rating, notes } = req.body || {};
    const vendor = await prisma.vendor.create({ data: { managerId: profile.id, name, email, phone, company, categories: categories || [], rating: rating != null ? Number(rating) : null, notes } });
    res.status(201).json({ success: true, data: vendor });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create vendor' });
  }
});

// GET /api/v1/property-manager/vendors
router.get('/vendors', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const vendors = await prisma.vendor.findMany({ where: { managerId: profile.id } });
    res.json({ success: true, data: vendors });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Tasks ──────────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/tasks
router.post('/tasks', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { contactId, relatedType, relatedId, title, description, status, priority, dueDate, assigneeId } = req.body || {};
    const task = await prisma.task.create({ data: { managerId: profile.id, contactId, relatedType, relatedId, title, description, status: status || 'OPEN', priority: priority || 'MEDIUM', dueDate: dueDate ? new Date(dueDate) : null, assigneeId } });
    res.status(201).json({ success: true, data: task });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create task' });
  }
});

// GET /api/v1/property-manager/tasks
router.get('/tasks', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { status } = req.query;
    const tasks = await prisma.task.findMany({ where: { managerId: profile.id, ...(status ? { status: status as string } : {}) } });
    res.json({ success: true, data: tasks });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/property-manager/tasks/:id
router.patch('/tasks/:id', async (req: any, res: Response) => {
  try {
    const { status, completedAt } = req.body || {};
    const task = await prisma.task.update({ where: { id: req.params.id }, data: { status, completedAt: completedAt ? new Date(completedAt) : null } });
    res.json({ success: true, data: task });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update task' });
  }
});

// ── Communications ─────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/communications
router.post('/communications', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { contactId, type, direction, subject, body, duration, metadata } = req.body || {};
    const comm = await prisma.communication.create({ data: { managerId: profile.id, contactId, type, direction, subject, body, duration: duration != null ? Number(duration) : null, metadata } });
    res.status(201).json({ success: true, data: comm });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not log communication' });
  }
});

// GET /api/v1/property-manager/communications
router.get('/communications', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { contactId, type } = req.query;
    const comms = await prisma.communication.findMany({ where: { managerId: profile.id, ...(contactId ? { contactId: contactId as string } : {}), ...(type ? { type: type as string } : {}) }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: comms });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/property-manager/rent/:id/pay — create PayLio checkout for rent payment
router.post('/rent/:id/pay', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const payment = await prisma.rentPayment.findFirst({
      where: { id: req.params.id, property: { managerId: profile.id } },
      include: { property: { include: { manager: { include: { user: { select: { email: true } } } } } } },
    });

    if (!payment) return res.status(404).json({ error: 'Rent payment not found' });
    if (payment.status === 'PAID') return res.status(400).json({ error: 'Rent already paid' });

    const { paylioService } = await import('../services/paylio.service');
    const API_BASE = (process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
    const callback = `${API_BASE}/property/rent/${payment.id}/paylio/callback`;

    const walletAddress = payment.property.manager.user?.email || profile.id;
    const checkout = await paylioService.createCheckout({
      address: walletAddress,
      amount: payment.amount,
      currency: 'USD',
      callback,
      email: payment.tenantEmail,
      note: `Rent payment for ${payment.property.title || 'property'} - ${payment.tenantEmail}`,
    });

    // Store PayLio reference in rent payment notes
    await prisma.rentPayment.update({
      where: { id: payment.id },
      data: { notes: `${payment.notes || ''}\nPayLio checkout: ${checkout.url} (${checkout.id})` },
    });

    res.json({ success: true, data: { url: checkout.url, gateway: 'paylio', paymentId: payment.id, amount: payment.amount } });
  } catch (e: any) {
    console.error('[rent] paylio checkout failed:', e.message);
    res.status(500).json({ error: 'Could not initiate rent payment' });
  }
});

// GET /api/v1/property/rent/:id/paylio/callback — PayLio callback for rent payments
router.get('/rent/:id/paylio/callback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const status = String(req.query.status || '').toLowerCase();

    const payment = await prisma.rentPayment.findUnique({
      where: { id },
      include: { property: { include: { manager: { include: { user: { select: { email: true } } } } } } },
    });

    if (!payment) return res.status(404).send('Payment not found');

    if (status === 'paid') {
      await prisma.rentPayment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: new Date(), method: 'ONLINE', notes: `${payment.notes || ''}\nPaid via PayLio` },
      });

      // Log financial record
      await prisma.propertyFinancial.create({
        data: {
          propertyId: payment.propertyId,
          unitId: payment.unitId || undefined,
          type: 'INCOME',
          category: 'RENT',
          amount: payment.amount,
          description: `Rent payment from ${payment.tenantEmail} via PayLio`,
          tenantEmail: payment.tenantEmail,
        },
      });

      // Send receipt
      try {
        const { notificationService } = await import('../services/notification.service');
        await notificationService.sendEmail({
          to: payment.tenantEmail,
          subject: `Rent Payment Receipt - ${payment.property.title || 'Property'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #2563eb;">Payment Receipt</h2>
              <p>Thank you for your rent payment of <strong>$${payment.amount.toFixed(2)}</strong>.</p>
              <p>Payment method: PayLio (USDC)</p>
              <p>Date: ${new Date().toLocaleDateString()}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 12px; color: #777;">Property: ${payment.property.title || 'N/A'}</p>
            </div>
          `,
        });
      } catch (e: any) {
        console.warn('[rent] receipt failed:', e.message);
      }
    }

    const FRONTEND = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://pabandi.com';
    const successUrl = `${FRONTEND}/tenant/rent/${payment.id}?status=paid`;
    const cancelUrl = `${FRONTEND}/tenant/rent/${payment.id}?status=cancelled`;

    if (status === 'paid') return res.redirect(successUrl);
    return res.redirect(cancelUrl);
  } catch (e: any) {
    console.error('[rent] paylio callback error:', e);
    res.status(500).send('Callback processing failed');
  }
});

// ── E-Signature ───────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/leases/:id/sign — create signing request
router.post('/leases/:id/sign', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const lease = await prisma.propertyLease.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!lease) return res.status(404).json({ error: 'Lease not found' });

    const { signerEmail, signerName, provider = 'CUSTOM' } = req.body || {};
    if (!signerEmail) return res.status(400).json({ error: 'signerEmail is required' });

    const callbackToken = crypto.randomBytes(32).toString('hex');
    const API_BASE = (process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');

    let signingUrl = `${API_BASE}/property/sign/${callbackToken}`;
    let externalId = '';

    try {
      const { signingService } = await import('../services/signing.service');
      const result = await signingService.createRequest({
        provider: provider as any,
        documentTitle: `Lease - ${lease.propertyId || 'Property'}`,
        signerEmail,
        signerName: signerName || lease.tenantEmail,
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tenant/lease?status=signed`,
        metadata: { leaseId: lease.id, tenantEmail: lease.tenantEmail },
      });
      signingUrl = result.signingUrl;
      externalId = result.externalId;
    } catch (e: any) {
      logger.warn('[sign] provider failed, using custom fallback', e.message);
    }

    const signingRequest = await prisma.signingRequest.create({
      data: {
        managerId: profile.id,
        leaseId: lease.id,
        documentType: 'LEASE',
        signerEmail,
        signerName,
        provider,
        signingUrl,
        callbackToken,
        status: 'SENT',
        providerId: externalId || undefined,
        metadata: { leaseId: lease.id, tenantEmail: lease.tenantEmail },
      },
    });

    res.status(201).json({ success: true, data: signingRequest });
  } catch (e: any) {
    console.error('[sign] create failed:', e.message);
    res.status(500).json({ error: 'Could not create signing request' });
  }
});

// GET /api/v1/property/sign/:token — signing page
router.get('/sign/:token', async (req: Request, res: Response) => {
  try {
    const signingRequest = await prisma.signingRequest.findUnique({
      where: { callbackToken: req.params.token },
      include: { lease: true },
    });

    if (!signingRequest) return res.status(404).send('Signing link not found');
    if (signingRequest.status === 'SIGNED') return res.status(400).send('Document already signed');
    if (signingRequest.status === 'EXPIRED') return res.status(400).send('Signing link expired');

    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sign Document</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #f5f5f5; }
          .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; }
          .status { background: #e3f2fd; color: #1976d2; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
          button { background: #4caf50; color: white; border: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; }
          button:hover { background: #43a047; }
          .notice { margin-top: 20px; padding: 12px; background: #fff3cd; color: #856404; border-radius: 8px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Sign Your Lease</h1>
          <div class="status">Status: ${signingRequest.status}</div>
          <p><strong>Property:</strong> ${signingRequest.lease?.propertyId || 'N/A'}</p>
          <p><strong>Tenant:</strong> ${signingRequest.lease?.tenantEmail || 'N/A'}</p>
          <p><strong>Lease Period:</strong> ${signingRequest.lease ? new Date(signingRequest.lease.startDate).toLocaleDateString() + ' → ' + new Date(signingRequest.lease.endDate).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Rent:</strong> $${signingRequest.lease?.rentAmount?.toFixed(2) || 'N/A'}/${signingRequest.lease?.rentPeriod?.toLowerCase() || 'mo'}</p>
          <form method="POST" action="/api/v1/property/sign/${signingRequest.callbackToken}/confirm">
            <button type="submit">✓ I Agree - Sign Document</button>
          </form>
          <div class="notice">
            <strong>Note:</strong> This is a demo signing flow. In production, this would integrate with DocuSign, HelloSign, or PandaDoc for legally binding e-signatures.
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (e: any) {
    res.status(500).send('Error loading signing page');
  }
});

// POST /api/v1/property/sign/:token/confirm — confirm signature
router.post('/sign/:token/confirm', async (req: Request, res: Response) => {
  try {
    const signingRequest = await prisma.signingRequest.findUnique({
      where: { callbackToken: req.params.token },
      include: { lease: true },
    });

    if (!signingRequest) return res.status(404).json({ error: 'Signing link not found' });
    if (signingRequest.status === 'SIGNED') return res.status(400).json({ error: 'Already signed' });

    const updated = await prisma.signingRequest.update({
      where: { id: signingRequest.id },
      data: { status: 'SIGNED', signedAt: new Date() },
    });

    // Update lease status to ACTIVE if it was in DRAFT
    if (signingRequest.leaseId && signingRequest.lease?.status === 'DRAFT') {
      await prisma.propertyLease.update({
        where: { id: signingRequest.leaseId },
        data: { status: 'ACTIVE' },
      });
    }

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/tenant/lease?status=signed`);
  } catch (e: any) {
    res.status(500).json({ error: 'Could not confirm signature' });
  }
});

// ── Rent Automation ────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/rent/automation/run — trigger rent automation manually
router.post('/rent/automation/run', authenticate, async (_req: any, res: Response) => {
  try {
    const result = await rentAutomationService.runDailyRentAutomation();
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Rent automation failed' });
  }
});

// POST /api/v1/property-manager/rent/:id/mark-paid — mark a rent payment as paid
router.post('/rent/:id/mark-paid', authenticate, async (req: any, res: Response) => {
  try {
    const { method, reference } = req.body || {};
    const payment = await rentAutomationService.markRentPaid(req.params.id, method || 'MANUAL', reference);
    res.json({ success: true, data: payment });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not mark rent as paid' });
  }
});

export default router;
