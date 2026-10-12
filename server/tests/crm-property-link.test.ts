import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Linking a CRM client to a property tenancy.
 *
 * THE DEFECT THIS EXISTS TO PREVENT
 * `PropertyTenant` and `CrmClient` were the same human in two tables with nothing
 * connecting them. Several services joined them by comparing email strings, which
 * is not a constraint: change an address on one side and the other side silently
 * points at nobody, or worse at the wrong person. The link is now a real foreign
 * key, and these tests pin the two properties that make it safe to rely on — that
 * it cannot reach across tenants, and that it cannot be made ambiguous.
 *
 * Why those two specifically:
 *   - a link that ignored ownership would let a landlord attach someone else's
 *     tenant to their own client and read that tenant's rent position;
 *   - a non-unique link would make "the tenant for this client" return more than
 *     one row, and whichever came back first would look authoritative.
 */

const CLIENT_ID = 'client_1';
const OTHER_CLIENT_ID = 'client_2';

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmClient: { findFirst: vi.fn() },
    propertyTenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    rentPayment: { findMany: vi.fn(async () => []) },
    propertyMaintenance: { findMany: vi.fn(async () => []) },
    propertyManagerProperty: { findUnique: vi.fn() },
  },
}));

vi.mock('../src/middleware/crmContext.middleware', () => ({
  resolveCrmBusiness: (req: any, _res: any, next: any) => {
    req.crm = { userId: 'user_1', serviceBusinessId: 'svc_1', businessId: 'biz_1' };
    next();
  },
  requireCrmContext: (req: any) => req.crm,
}));

// The real authenticate() needs JWT_SECRET and a real token. This router applies
// it router-wide, so without the mock every request 500s before reaching a handler
// and every assertion below fails for the same uninformative reason.
vi.mock('../src/middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user_1', email: 'owner@example.com', role: 'ADMIN' };
    next();
  },
}));

import { prisma } from '../src/utils/database';
import router from '../src/routes/crmPropertyLink.routes';

/**
 * Drive an express Router with a fake req/res and return the response.
 *
 * Router-wide middleware (`router.use(...)`) runs first, then only the ONE route
 * layer whose path and method match. Walking every layer instead would run both
 * the GET and the POST handler on every call, so a POST assertion would be
 * answering from whichever handler happened to respond last.
 */
async function call(path: string, method: 'get' | 'post', req: any = {}) {
  const layers = (router as any).stack;

  const res: any = { statusCode: 200, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };

  const request: any = {
    method: method.toUpperCase(),
    params: { id: CLIENT_ID },
    query: {},
    body: {},
    headers: { authorization: 'Bearer test' },
    user: { id: 'user_1' },
    ...req,
  };

  const finish = (err?: any) => (err
    ? { statusCode: 500, body: { error: String(err?.message) } }
    : res);

  // 1. router-wide middleware, in order, until one answers.
  for (const layer of layers) {
    if (layer.route) continue;
    let answered = false;
    let err: any = null;
    await layer.handle(request, res, (e?: any) => { answered = true; err = e ?? null; });
    if (err) return finish(err);
    if (answered && res.body !== null) return res;
  }

  // 2. the single matching route.
  const routeLayer = layers.find(
    (l: any) => l.route?.path === path && !!l.route.methods[method],
  );
  if (!routeLayer) throw new Error(`no route for ${method.toUpperCase()} ${path}`);

  for (const handler of routeLayer.route.stack) {
    let answered = false;
    let err: any = null;
    await handler.handle(request, res, (e?: any) => { answered = true; err = e ?? null; });
    if (err) return finish(err);
    if (answered && res.body !== null) return res;
  }

  return res;
}

/** The client the caller owns. */
function ownsClient() {
  (prisma.crmClient.findFirst as any).mockResolvedValue({ id: CLIENT_ID, name: 'Ayesha Khan', email: 'ayesha@example.com' });
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.rentPayment.findMany as any).mockResolvedValue([]);
  (prisma.propertyMaintenance.findMany as any).mockResolvedValue([]);
  (prisma.propertyTenant.findUnique as any).mockResolvedValue(null);
  (prisma.propertyManagerProperty.findUnique as any).mockResolvedValue({ id: 'profile_1' });
});

describe('reading the tenancy on a client', () => {
  it('says so plainly when the client is not a tenant', async () => {
    ownsClient();
    const res = await call('/clients/:id/property', 'get');

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({ isTenant: false });
  });

  it('returns the lease and rent position for a linked tenant', async () => {
    ownsClient();
    (prisma.propertyTenant.findUnique as any).mockResolvedValue({
      id: 'tenant_1', status: 'ACTIVE', riskBand: 'LOW',
      email: 'ayesha@example.com',
      property: { id: 'prop_1', title: 'Riverside' },
      leases: [{ id: 'lease_1', status: 'ACTIVE', rentAmount: 1200 }],
      ledgers: [],
    });
    (prisma.rentPayment.findMany as any).mockResolvedValue([
      { amount: 1200, status: 'PAID', dueDate: new Date(Date.now() - 40 * 864e5) },
      { amount: 1200, status: 'OVERDUE', dueDate: new Date(Date.now() - 10 * 864e5) },
      { amount: 1200, status: 'PAID', dueDate: new Date(Date.now() - 70 * 864e5) },
    ]);

    const res = await call('/clients/:id/property', 'get');

    expect(res.body.data.isTenant).toBe(true);
    expect(res.body.data.rent).toEqual({
      billed: 3600, collected: 2400, outstanding: 1200, overdueCount: 1,
    });
  });

  it('404s a client belonging to another business', async () => {
    (prisma.crmClient.findFirst as any).mockResolvedValue(null);
    const res = await call('/clients/:id/property', 'get');

    expect(res.statusCode).toBe(404);
    // And it must not have gone looking for a tenant on the way out.
    expect(prisma.propertyTenant.findUnique).not.toHaveBeenCalled();
  });

  it('scopes the client lookup to this service business', async () => {
    ownsClient();
    await call('/clients/:id/property', 'get');

    const where = (prisma.crmClient.findFirst as any).mock.calls[0][0].where;
    expect(where).toEqual({ id: CLIENT_ID, serviceBusinessId: 'svc_1' });
  });
});

describe('creating the link', () => {
  it('is idempotent — linking twice returns the same tenancy', async () => {
    ownsClient();
    (prisma.propertyTenant.findUnique as any).mockResolvedValue({ id: 'tenant_1', crmClientId: CLIENT_ID });

    const res = await call('/clients/:id/property', 'post');

    expect(res.statusCode).toBe(200);
    expect(res.body.created).toBe(false);
    // A second click must not create a second tenant.
    expect(prisma.propertyTenant.upsert).not.toHaveBeenCalled();
  });

  it('refuses to attach a tenant that already belongs to another client', async () => {
    ownsClient();
    (prisma.propertyTenant.findFirst as any).mockResolvedValue({ id: 'tenant_9', crmClientId: OTHER_CLIENT_ID });

    const res = await call('/clients/:id/property', 'post', { body: { tenantId: 'tenant_9' } });

    expect(res.statusCode).toBe(409);
    expect(prisma.propertyTenant.update).not.toHaveBeenCalled();
  });

  it('refuses a tenant owned by a different landlord', async () => {
    ownsClient();
    // This landlord has no property profile, so the ownership predicate cannot be
    // satisfied and the tenant must not be found.
    (prisma.propertyManagerProperty.findUnique as any).mockResolvedValue(null);
    (prisma.propertyTenant.findFirst as any).mockResolvedValue(null);

    const res = await call('/clients/:id/property', 'post', { body: { tenantId: 'tenant_9' } });

    expect(res.statusCode).toBe(404);
    expect(prisma.propertyTenant.update).not.toHaveBeenCalled();
  });

  it('refuses to create a tenancy for a business with no PropertyOS setup', async () => {
    ownsClient();
    (prisma.propertyManagerProperty.findUnique as any).mockResolvedValue(null);

    const res = await call('/clients/:id/property', 'post', { body: {} });

    expect(res.statusCode).toBe(403);
    expect(prisma.propertyTenant.upsert).not.toHaveBeenCalled();
  });

  it('refuses when the client has no email to identify them by', async () => {
    (prisma.crmClient.findFirst as any).mockResolvedValue({ id: CLIENT_ID, name: 'No Email', email: null });

    const res = await call('/clients/:id/property', 'post', { body: {} });

    expect(res.statusCode).toBe(400);
  });

  it('creates the tenancy with the client link attached', async () => {
    ownsClient();
    (prisma.propertyTenant.upsert as any).mockResolvedValue({ id: 'tenant_new' });

    const res = await call('/clients/:id/property', 'post', { body: {} });

    expect(res.statusCode).toBe(201);
    const args = (prisma.propertyTenant.upsert as any).mock.calls[0][0];
    expect(args.create.crmClientId).toBe(CLIENT_ID);
    expect(args.create.email).toBe('ayesha@example.com');
    expect(args.create.managerId).toBe('profile_1');
    // The name splits into first/last rather than being stored whole.
    expect(args.create.firstName).toBe('Ayesha');
    expect(args.create.lastName).toBe('Khan');
  });
});