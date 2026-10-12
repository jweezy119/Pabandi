import { Router, type Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';

/**
 * The property half of a CRM client.
 *
 * A landlord and a salon owner can both be customers of the same platform, and
 * until this existed the two records for the same human were unrelated rows that
 * only agreed on an email string. These endpoints make the link explicit and
 * typed, and expose the tenancy facts that the CRM otherwise cannot see: who
 * lives in which unit, on what lease, paying how much, and what they owe.
 *
 * TENANCY
 * `requireCrmBusiness` resolves the caller's serviceBusinessId; every client is
 * read through it. The property side is scoped by `PropertyTenant.crmClientId`
 * now that the column exists, rather than by matching emails — which is the whole
 * point of the link.
 */

const router = Router();

// Both applied here rather than inherited. This router is mounted as a sibling
// of /api/v1/crm, not inside it, so it does not get crm.routes' router-wide
// middleware — and without these, `requireCrmContext` below would throw a 500 on
// every request instead of returning the caller's business.
router.use(authenticate);
router.use(resolveCrmBusiness);

/** The caller owns this client, or 404. Same shape as the rest of the CRM. */
async function ownedClient(req: AuthRequest, clientId: string) {
  const crm = requireCrmContext(req);
  const client = await prisma.crmClient.findFirst({
    where: { id: clientId, serviceBusinessId: crm.serviceBusinessId },
  });
  if (!client) throw new CustomError('Client not found', 404);
  return client;
}

/**
 * GET /api/v1/crm/clients/:id/property
 *
 * Everything the CRM knows about this person as a tenant: the tenancy, its
 * leases, their rent position, and any maintenance they have raised.
 *
 * `null` for every section when they are not a tenant. That is the honest answer
 * for the majority of CRM clients — most are not tenants — and it is what the
 * client renders as "no tenancy on file".
 */
router.get('/clients/:id/property', async (req: AuthRequest, res: Response) => {
  try {
    const client = await ownedClient(req, req.params.id);
    const tenant = await prisma.propertyTenant.findUnique({
      where: { crmClientId: client.id },
      include: {
        property: { select: { id: true, title: true, address: true, city: true, state: true } },
        leases: { orderBy: { startDate: 'desc' } },
        ledgers: { orderBy: { date: 'desc' }, take: 12 },
      },
    });

    if (!tenant) {
      res.json({ success: true, data: { isTenant: false } });
      return;
    }

    // Rent position is derived from real payment rows rather than the balance
    // columns on the tenant, which are written by a separate wallet flow and can
    // lag. Outstanding = everything billed that is not marked paid.
    const payments = await prisma.rentPayment.findMany({
      where: { tenantEmail: tenant.email },
      select: { amount: true, status: true, dueDate: true },
    });
    const billed = payments.reduce((sum, p) => sum + p.amount, 0);
    const collected = payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);
    const overdue = payments.filter(
      (p) => p.status !== 'PAID' && p.dueDate && new Date(p.dueDate) < new Date(),
    );

    res.json({
      success: true,
      data: {
        isTenant: true,
        tenant: {
          id: tenant.id,
          status: tenant.status,
          riskBand: tenant.riskBand,
          property: tenant.property,
        },
        leases: tenant.leases,
        ledger: tenant.ledgers,
        rent: {
          billed,
          collected,
          outstanding: billed - collected,
          overdueCount: overdue.length,
        },
        maintenance: await prisma.propertyMaintenance.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      },
    });
  } catch (e) {
    if (e instanceof CustomError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: 'Could not load the tenancy' });
  }
});

/**
 * POST /api/v1/crm/clients/:id/property
 *
 * Link this client to an existing property tenant, or create the tenant record
 * from the client's own details.
 *
 * Idempotent by design. Re-linking returns the existing tenancy rather than
 * erroring, because the natural reaction to "already linked" is to click again,
 * and a second click creating a duplicate tenant would be worse than a no-op.
 */
router.post('/clients/:id/property', async (req: AuthRequest, res: Response) => {
  try {
    const client = await ownedClient(req, req.params.id);
    const crm = requireCrmContext(req);

    const existing = await prisma.propertyTenant.findUnique({
      where: { crmClientId: client.id },
    });
    if (existing) {
      res.status(200).json({ success: true, data: existing, created: false });
      return;
    }

    const { tenantId, propertyId } = req.body || {};
    if (tenantId) {
      // Link an existing tenant. The manager check keeps a landlord from
      // attaching somebody else's tenant to their client record.
      const profile = await prisma.propertyManagerProperty.findUnique({
        where: { userId: crm.userId },
        select: { id: true },
      });
      const tenant = await prisma.propertyTenant.findFirst({
        where: { id: tenantId, ...(profile ? { managerId: profile.id } : {}) },
      });
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found for this business' });
        return;
      }
      if (tenant.crmClientId && tenant.crmClientId !== client.id) {
        res.status(409).json({ error: 'That tenant is already linked to another client' });
        return;
      }
      const linked = await prisma.propertyTenant.update({
        where: { id: tenant.id },
        data: { crmClientId: client.id },
      });
      res.status(200).json({ success: true, data: linked, created: false });
      return;
    }

    // Create a tenancy for this client directly.
    const email = (client.email || '').toLowerCase().trim();
    if (!email) {
      res.status(400).json({ error: 'This client has no email address to identify them by' });
      return;
    }
    const profile = await prisma.propertyManagerProperty.findUnique({
      where: { userId: crm.userId },
      select: { id: true },
    });
    if (!profile) {
      res.status(403).json({
        error: 'Set up PropertyOS for this business before creating a tenancy',
      });
      return;
    }

    const [firstName, ...rest] = String(client.name || '').trim().split(/\s+/);
    const created = await prisma.propertyTenant.upsert({
      where: { managerId_email: { managerId: profile.id, email } },
      update: { crmClientId: client.id },
      create: {
        managerId: profile.id,
        crmClientId: client.id,
        email,
        firstName: firstName || null,
        lastName: rest.join(' ') || null,
        propertyId: propertyId || null,
        status: 'ACTIVE',
      },
    });

    res.status(201).json({ success: true, data: created, created: true });
  } catch (e) {
    if (e instanceof CustomError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: 'Could not link the tenancy' });
  }
});

export default router;