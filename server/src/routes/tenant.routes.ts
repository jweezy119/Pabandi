import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import crypto from 'crypto';

const prisma = new PrismaClient();
const router = Router();

// ── Public: Get a manager's public listing info (for application flow) ────────

// GET /api/v1/tenant/portal/:slug — public listing info (tenant-facing).
router.get('/portal/:slug', async (req: Request, res: Response) => {
  try {
    const profile = await prisma.propertyManagerProfile.findUnique({
      where: { slug: req.params.slug },
      include: {
        properties: { where: { status: 'VACANT' } },
        _count: { select: { properties: true } },
      },
    });
    if (!profile || !profile.active) return res.status(404).json({ error: 'Portal not found' });
    res.json({
      success: true,
      data: {
        companyName: profile.companyName,
        slug: profile.slug,
        brandColor: profile.brandColor,
        logoUrl: profile.logoUrl,
        tagline: profile.tagline,
        listings: profile.properties.map((p: any) => ({
          id: p.id, title: p.title, address: p.address, city: p.city, state: p.state,
          bedrooms: p.bedrooms, bathrooms: p.bathrooms, rentAmount: p.rentAmount, rentPeriod: p.rentPeriod,
        })),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Public: Submit an application ────────────────────────────────────────────

// POST /api/v1/tenant/apply
// A tenant applies to a property listing. No auth required (email-based tracking).
router.post('/apply', async (req: Request, res: Response) => {
  try {
    const { slug, propertyId, email, firstName, lastName, phone, message, desiredMoveIn, monthlyIncome } = req.body || {};
    if (!slug || !email) return res.status(400).json({ error: 'slug and email are required' });

    const profile = await prisma.propertyManagerProfile.findUnique({ where: { slug: String(slug).toLowerCase() } });
    if (!profile || !profile.active) return res.status(404).json({ error: 'Portal not found' });

    // If propertyId provided, validate it belongs to this manager.
    if (propertyId) {
      const property = await prisma.propertyManagerProperty.findFirst({ where: { id: propertyId, managerId: profile.id } });
      if (!property) return res.status(404).json({ error: 'Property not found' });
    }

    // 1. Upsert the tenant record on the manager's profile (no synthetic data).
    const tenant = await prisma.propertyTenant.upsert({
      where: { managerId_email: { managerId: profile.id, email: String(email).toLowerCase().trim() } },
      update: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        status: 'APPLIED',
        lastStayAt: new Date(),
      },
      create: {
        managerId: profile.id,
        email: String(email).toLowerCase().trim(),
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        propertyId: propertyId || null,
        status: 'APPLIED',
        notes: 'Applied via public portal',
      },
    });

    // 2. Create the application record.
    const application = await prisma.tenantApplication.create({
      data: {
        managerId: profile.id,
        propertyId: propertyId || null,
        tenantId: tenant.id,
        email: String(email).toLowerCase().trim(),
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        message: message || null,
        desiredMoveIn: desiredMoveIn ? new Date(desiredMoveIn) : null,
        monthlyIncome: monthlyIncome != null ? Number(monthlyIncome) : null,
        status: 'SUBMITTED',
      },
    });

    res.status(201).json({
      success: true,
      data: { applicationId: application.id, status: application.status, tenantId: tenant.id, message: 'Application submitted. The property manager will review and run a background check.' },
    });
  } catch (e: any) {
    console.error('[tenant] apply failed:', e.message);
    res.status(500).json({ error: 'Could not submit application' });
  }
});

// ── Authenticated tenant endpoints ────────────────────────────────────────────

// GET /api/v1/tenant/dashboard — tenant's own dashboard (by email).
router.get('/dashboard', authenticate, async (req: any, res: Response) => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) return res.status(401).json({ error: 'Unauthorized' });

    const [applications, leases, documents] = await Promise.all([
      prisma.tenantApplication.findMany({ where: { email: userEmail }, orderBy: { createdAt: 'desc' } }),
      prisma.propertyLease.findMany({ where: { tenantEmail: userEmail }, orderBy: { createdAt: 'desc' } }),
      prisma.tenantDocument.findMany({ where: { tenantEmail: userEmail }, orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({ success: true, data: { applications, leases, documents } });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/tenant/applications — list tenant's applications.
router.get('/applications', authenticate, async (req: any, res: Response) => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) return res.status(401).json({ error: 'Unauthorized' });
    const applications = await prisma.tenantApplication.findMany({ where: { email: userEmail }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: applications });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/tenant/applications/:id — single application detail.
router.get('/applications/:id', authenticate, async (req: any, res: Response) => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) return res.status(401).json({ error: 'Unauthorized' });
    const application = await prisma.tenantApplication.findFirst({ where: { id: req.params.id, email: userEmail } });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    res.json({ success: true, data: application });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/tenant/documents — list tenant's documents.
router.get('/documents', authenticate, async (req: any, res: Response) => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) return res.status(401).json({ error: 'Unauthorized' });
    const documents = await prisma.tenantDocument.findMany({ where: { tenantEmail: userEmail }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: documents });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
