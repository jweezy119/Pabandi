import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import crypto from 'crypto';

const prisma = new PrismaClient();
const router = Router();

function generateSlug(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
}

// POST /api/v1/property-manager/enroll
// Any authenticated user can enroll as a property manager / landlord.
router.post('/enroll', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (existing) return res.json({ success: true, profile: existing, created: false });

    const { companyName, slug, brandColor, tagline } = req.body || {};
    const profile = await prisma.propertyManagerProfile.create({
      data: {
        userId,
        companyName: companyName || null,
        slug: slug || generateSlug(companyName || `landlord-${userId.slice(-6)}`),
        brandColor: brandColor || null,
        tagline: tagline || null,
      },
    });
    res.status(201).json({ success: true, profile, created: true });
  } catch (e: any) {
    console.error('[pm] enroll failed:', e.message);
    res.status(500).json({ error: 'Could not enroll' });
  }
});

// GET /api/v1/property-manager/me — manager profile + stats.
router.get('/me', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({
      where: { userId },
      include: {
        _count: { select: { properties: true, tenants: true } },
      },
    });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    res.json({ success: true, data: profile });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/property-manager/dashboard — full CRM snapshot.
router.get('/dashboard', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const [properties, tenants, screenings] = await Promise.all([
      prisma.propertyManagerProperty.findMany({ where: { managerId: profile.id }, orderBy: { createdAt: 'desc' } }),
      prisma.propertyTenant.findMany({ where: { managerId: profile.id }, orderBy: { lastStayAt: 'desc' }, take: 100 }),
      prisma.propertyScreening.findMany({ where: { managerId: profile.id }, orderBy: { screenedAt: 'desc' }, take: 50 }),
    ]);

    const stats = {
      totalProperties: properties.length,
      occupied: properties.filter((p: any) => p.status === 'OCCUPIED').length,
      vacant: properties.filter((p: any) => p.status === 'VACANT').length,
      totalTenants: tenants.length,
      activeTenants: tenants.filter((t: any) => t.status === 'ACTIVE').length,
      totalDepositHeld: tenants.reduce((s: number, t: any) => s + (t.depositHeld || 0), 0),
      highRiskTenants: tenants.filter((t: any) => t.riskBand === 'HIGH').length,
      totalDisputes: tenants.reduce((s: number, t: any) => s + (t.totalDisputes || 0), 0),
    };

    res.json({ success: true, data: { profile, properties, tenants, screenings, stats } });
  } catch (e: any) {
    console.error('[pm] dashboard failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Properties ────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/properties — add a property.
router.post('/properties', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { title, address, city, state, zip, country, bedrooms, bathrooms, rentAmount, rentPeriod, status } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required' });

    const property = await prisma.propertyManagerProperty.create({
      data: {
        managerId: profile.id,
        title,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        country: country || 'United States',
        bedrooms: bedrooms || 1,
        bathrooms: bathrooms || 1,
        rentAmount: rentAmount != null ? Number(rentAmount) : null,
        rentPeriod: rentPeriod || 'MONTH',
        status: status || 'VACANT',
      },
    });
    res.status(201).json({ success: true, data: property });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not add property' });
  }
});

// ── Tenants ───────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/tenants — add/update a tenant (history tracked by email).
router.post('/tenants', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { email, firstName, lastName, phone, propertyId, status, notes } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await prisma.propertyTenant.findFirst({
      where: { managerId: profile.id, email: normalizedEmail },
    });

    const tenant = existing
      ? await prisma.propertyTenant.update({
          where: { id: existing.id },
          data: {
            firstName: firstName ?? existing.firstName,
            lastName: lastName ?? existing.lastName,
            phone: phone ?? existing.phone,
            propertyId: propertyId ?? existing.propertyId,
            status: status ?? existing.status,
            notes: notes ?? existing.notes,
          },
        })
      : await prisma.propertyTenant.create({
          data: {
            managerId: profile.id,
            email: normalizedEmail,
            firstName: firstName || null,
            lastName: lastName || null,
            phone: phone || null,
            propertyId: propertyId || null,
            status: status || 'PROSPECT',
            notes: notes || null,
          },
        });

    res.status(existing ? 200 : 201).json({ success: true, data: tenant });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not save tenant' });
  }
});

// ── Screening ─────────────────────────────────────────────────────────────────

// POST /api/v1/property-manager/screen — screen a tenant (US CourtListener or PK rail).
router.post('/screen', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { tenantEmail, tenantName, source, band } = req.body || {};
    if (!tenantEmail) return res.status(400).json({ error: 'tenantEmail is required' });

    const resolvedBand = (band || 'LOW').toUpperCase();
    const depositAdjPct = resolvedBand === 'HIGH' ? 25 : resolvedBand === 'MEDIUM' ? 10 : 0;

    const screening = await prisma.propertyScreening.create({
      data: {
        managerId: profile.id,
        tenantEmail: String(tenantEmail).toLowerCase().trim(),
        tenantName: tenantName || null,
        band: resolvedBand,
        depositAdjPct,
        source: source || 'MANUAL',
        notes: null,
      },
    });

    const normalizedEmail = String(tenantEmail).toLowerCase().trim();
    const existing = await prisma.propertyTenant.findFirst({
      where: { managerId: profile.id, email: normalizedEmail },
    });
    if (existing) {
      await prisma.propertyTenant.update({
        where: { id: existing.id },
        data: { riskBand: resolvedBand },
      });
    } else {
      await prisma.propertyTenant.create({
        data: {
          managerId: profile.id,
          email: normalizedEmail,
          firstName: tenantName || null,
          riskBand: resolvedBand,
          status: 'PROSPECT',
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        screening,
        recommendation: depositAdjPct > 0
          ? `${resolvedBand} risk — recommend ${depositAdjPct}% higher deposit.`
          : `${resolvedBand} risk — standard deposit terms.`,
      },
    });
  } catch (e: any) {
    console.error('[pm] screen failed:', e.message);
    res.status(500).json({ error: 'Could not screen tenant' });
  }
});

// White-label: GET /api/v1/property-manager/portal/:slug — public branded portal info.
router.get('/portal/:slug', async (req: Request, res: Response) => {
  try {
    const profile = await prisma.propertyManagerProfile.findUnique({
      where: { slug: req.params.slug },
      include: {
        properties: { where: { status: 'VACANT' } },
        _count: { select: { properties: true, tenants: true } },
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
        activeListings: profile.properties.length,
        totalProperties: profile._count.properties,
        vacantListings: profile.properties.map((p: any) => ({
          id: p.id,
          title: p.title,
          address: p.address,
          city: p.city,
          state: p.state,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          rentAmount: p.rentAmount,
          rentPeriod: p.rentPeriod,
        })),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
