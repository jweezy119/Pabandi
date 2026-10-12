import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tenant isolation for the property CRM surface.
 *
 * THE DEFECT THIS EXISTS TO PREVENT
 * Every handler on /api/v1/crm-advanced authenticated the caller but never asked
 * which landlord they were. The reads returned platform-wide data — overdue rent,
 * expiring leases, financial statements for any property id typed into the URL —
 * and four of the writes (monthly rent generation, late fees, lease-expiration
 * sweeps, the automation runner) iterate every schedule on the platform and
 * mutate it, so any signed-in account could write financial records against every
 * other landlord's tenants.
 *
 * The property tables are empty in production today, so nothing leaked yet. These
 * tests exist because the endpoints are aimed at money and would have leaked the
 * moment a landlord added a property.
 *
 * SCOPING KEY
 * `managerId` is declared as a foreign key to AbodeManager, but nothing in the
 * codebase ever creates an AbodeManager row — every writer stores a
 * PropertyManagerProperty id. These tests assert against that real behaviour, so
 * that a future migration to a genuine AbodeManager table cannot silently turn
 * every scoped query into a silent zero.
 */

const OWNER_A = 'user_a';
const OWNER_B = 'user_b';
const PROFILE_A = 'profile_a';
const PROFILE_B = 'profile_b';
const PROPERTY_A = 'prop_a';
const PROPERTY_B = 'prop_b';

vi.mock('../src/utils/database', () => ({
  prisma: {
    propertyManagerProperty: {
      findUnique: vi.fn(),
      findMany: vi.fn(async () => []),
    },
    rentPayment: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    propertyLease: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), update: vi.fn() },
    propertyTenant: { findFirst: vi.fn(async () => null) },
    propertyUnit: { findFirst: vi.fn(async () => null) },
    propertyMaintenance: { findFirst: vi.fn(async () => null), update: vi.fn() },
    maintenanceVendor: { findMany: vi.fn(async () => []), create: vi.fn() },
    automationRule: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
    inspectionReport: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
    tenantLedger: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/services/crmAutomation.service', () => ({
  crmAutomationService: {
    generateMonthlyRent: vi.fn(async () => ({ generated: 0, errors: [] })),
    applyLateFees: vi.fn(async () => ({ applied: 0, totalAmount: 0, errors: [] })),
    checkLeaseExpirations: vi.fn(async () => ({ notified: 0, errors: [] })),
    autoAssignVendor: vi.fn(async () => ({ vendorId: 'v1', score: 1 })),
    generatePropertyFinancials: vi.fn(async () => ({ income: 0, expenses: 0 })),
    generateCashFlowForecast: vi.fn(async () => ({ months: [] })),
    calculateTenantRiskScore: vi.fn(async () => ({ score: 0, band: 'UNKNOWN' })),
  },
}));

import { prisma } from '../src/utils/database';
import { crmAutomationService } from '../src/services/crmAutomation.service';
import {
  getOverdueRent,
  getExpiringLeases,
  getPropertyFinancials,
  getCashFlowForecast,
  getTenantRisk,
  getTenantLedger,
  renewLease,
  generateMonthlyRent,
  applyLateFees,
  runAutomations,
} from '../src/controllers/crmAdvanced.controller';

/** Minimal Response double that records what the handler replied. */
function makeRes() {
  const res: any = { statusCode: 200, body: null };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: unknown) => { res.body = b; return res; });
  return res;
}

function req(user: { id: string; role?: string } | null, extra: Record<string, any> = {}) {
  return { user, params: {}, query: {}, body: {}, ...extra } as any;
}

/** The landlord that `req.user` resolves to, per the caller. */
function signedInAs(id: string, role = 'USER') {
  (prisma.propertyManagerProperty.findUnique as any).mockImplementation(async ({ where }: any) =>
    where.userId === OWNER_A
      ? { id: PROFILE_A }
      : where.userId === OWNER_B
        ? { id: PROFILE_B }
        : null,
  );
  // Only owner A has properties; owner B owns a different one.
  (prisma.propertyManagerProperty.findMany as any).mockImplementation(async ({ where }: any) =>
    where.managerId === PROFILE_A ? [{ id: PROPERTY_A }] : [],
  );
  return id === OWNER_A ? req({ id: OWNER_A, role }) : req({ id: OWNER_B, role });
}

/** The `where` predicate of the single recorded call to one prisma model. */
function whereOf(model: string): any {
  const mock = (prisma as any)[model];
  // Pick whichever verb was actually used. `??` does not work here: an unused
  // vi.fn() has `calls: []`, which is not nullish, so it would always win and
  // report zero calls for whichever method happened to be listed first.
  const used = ['findMany', 'findFirst', 'update']
    .map((m) => mock[m]?.mock?.calls)
    .find((calls) => calls && calls.length > 0);

  expect(used, `${model} should have been called`).toBeTruthy();
  expect(used.length, `${model} should have been called exactly once`).toBe(1);
  return used[0][0].where;
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.propertyManagerProperty.findMany as any).mockImplementation(async () => []);
});

describe('a landlord only reads their own rows', () => {
  it('scopes overdue rent to properties this landlord owns', async () => {
    const res = makeRes();
    await getOverdueRent(signedInAs(OWNER_A), res);

    const where = whereOf('rentPayment');
    expect(where.propertyId).toEqual({ in: [PROPERTY_A] });
    expect(where.propertyId).not.toContain(PROPERTY_B);
  });

  it('scopes expiring leases to this landlord', async () => {
    const res = makeRes();
    await getExpiringLeases(signedInAs(OWNER_A), res);

    expect(whereOf('propertyLease').managerId).toBe(PROFILE_A);
  });

  it('returns nothing at all for a landlord with no properties', async () => {
    const res = makeRes();
    await getOverdueRent(signedInAs(OWNER_B), res);

    // An empty result, not the other landlord's rows. This is the case that was
    // most dangerous: before, owner B saw all of owner A's rent.
    expect(whereOf('rentPayment').propertyId).toEqual({ in: [] });
  });
});

describe('money endpoints refuse another landlord\'s property', () => {
  it('404s a financial statement for a property this landlord does not own', async () => {
    const res = makeRes();
    await getPropertyFinancials(
      req({ id: OWNER_A, role: 'USER' }, { params: { propertyId: PROPERTY_B } }),
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(crmAutomationService.generatePropertyFinancials).not.toHaveBeenCalled();
  });

  it('404s a cashflow forecast for a property this landlord does not own', async () => {
    const res = makeRes();
    await getCashFlowForecast(
      req({ id: OWNER_A, role: 'USER' }, { params: { propertyId: PROPERTY_B } }),
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(crmAutomationService.generateCashFlowForecast).not.toHaveBeenCalled();
  });

  it('still serves a landlord their own property', async () => {
    signedInAs(OWNER_A);
    const res = makeRes();
    await getPropertyFinancials(
      req({ id: OWNER_A, role: 'USER' }, { params: { propertyId: PROPERTY_A } }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(crmAutomationService.generatePropertyFinancials).toHaveBeenCalled();
  });

  it('will not renew a lease belonging to someone else', async () => {
    signedInAs(OWNER_A); // installs the profile lookup for OWNER_A
    const res = makeRes();
    await renewLease(req({ id: OWNER_A, role: 'USER' }, { params: { id: 'lease_b' } }), res);

    // The owner is part of the lookup, so a foreign lease is simply not found.
    expect(whereOf('propertyLease').managerId).toBe(PROFILE_A);
    expect((prisma.propertyLease as any).update).not.toHaveBeenCalled();
  });
});

describe('tenant endpoints are scoped to the landlord\'s own tenant', () => {
  it('404s tenant risk for a tenant this landlord does not own', async () => {
    signedInAs(OWNER_A);
    const res = makeRes();
    await getTenantRisk(req({ id: OWNER_A, role: 'USER' }, { params: { tenantId: 'tenant_b' } }), res);

    expect(res.statusCode).toBe(404);
    expect(crmAutomationService.calculateTenantRiskScore).not.toHaveBeenCalled();
  });

  it('404s the tenant ledger for a tenant this landlord does not own', async () => {
    signedInAs(OWNER_A);
    const res = makeRes();
    await getTenantLedger(req({ id: OWNER_A, role: 'USER' }, { params: { tenantId: 'tenant_b' } }), res);

    expect(res.statusCode).toBe(404);
    expect(prisma.tenantLedger.findMany).not.toHaveBeenCalled();
  });
});

describe('platform-wide batch jobs are not callable by a normal user', () => {
  it('refuses rent generation for a non-admin', async () => {
    const res = makeRes();
    await generateMonthlyRent(req({ id: OWNER_A, role: 'USER' }), res);

    expect(res.statusCode).toBe(403);
    expect(crmAutomationService.generateMonthlyRent).not.toHaveBeenCalled();
  });

  it('refuses late fees for a non-admin', async () => {
    const res = makeRes();
    await applyLateFees(req({ id: OWNER_A, role: 'USER' }), res);

    expect(res.statusCode).toBe(403);
    expect(crmAutomationService.applyLateFees).not.toHaveBeenCalled();
  });

  it('refuses the automation runner for a non-admin', async () => {
    const res = makeRes();
    await runAutomations(req({ id: OWNER_A, role: 'USER' }), res);

    expect(res.statusCode).toBe(403);
    // None of the three mutating jobs may run on an unauthorised call.
    expect(crmAutomationService.generateMonthlyRent).not.toHaveBeenCalled();
    expect(crmAutomationService.applyLateFees).not.toHaveBeenCalled();
    expect(crmAutomationService.checkLeaseExpirations).not.toHaveBeenCalled();
  });

  it('still lets an admin run them', async () => {
    const res = makeRes();
    await runAutomations(req({ id: OWNER_A, role: 'ADMIN' }), res);

    expect(res.statusCode).toBe(200);
    expect(crmAutomationService.generateMonthlyRent).toHaveBeenCalled();
  });
});

describe('a caller who is not a property manager', () => {
  it('is refused rather than shown a platform-wide list', async () => {
    (prisma.propertyManagerProperty.findUnique as any).mockResolvedValue(null);
    const res = makeRes();

    await getOverdueRent(req({ id: 'nobody', role: 'USER' }), res);

    expect(res.statusCode).toBe(403);
    expect(prisma.rentPayment.findMany).not.toHaveBeenCalled();
  });
});