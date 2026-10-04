import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tenant resolution.
 *
 * WHY
 * ---
 * The codebase had three answers to "which tenant is this request for", and they
 * disagreed:
 *
 *   1. resolveCrmBusiness        — trusts body/query.businessId, but pairs it with
 *                                  `ownerId: userId`, so an unowned id resolves to
 *                                  nothing. Sound.
 *   2. tierGuard.resolveBusinessId — fell back to body/query.businessId with NO
 *                                  ownership predicate.
 *   3. resolveOwnedBusinessId    — server-derived only.
 *
 * (2) was unreachable today because every caller runs after resolveCrmBusiness, so the
 * fallback never fired. It was a loaded gun: the next route to mount tierGuard outside
 * the CRM router inherits it, and a limit evaluated against someone else's usage is not
 * an error anyone notices.
 *
 * So the fallbacks are gone, there is one resolver, and these tests pin that — including
 * the negative, because "we removed a dangerous fallback" is only worth something if a
 * test fails when it comes back.
 */

const owned = { crmServiceBusiness: { findFirst: vi.fn(), findUnique: vi.fn() } };

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmServiceBusiness: {
      findFirst: vi.fn(async (...args: unknown[]) => (owned.crmServiceBusiness.findFirst as any)(...args)),
      findUnique: vi.fn(async (...args: unknown[]) => (owned.crmServiceBusiness.findUnique as any)(...args)),
    },
  },
}));

vi.mock('../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  resolvePlatformBusinessId,
  resolveTenant,
  requireTenant,
  requirePlatformBusinessId,
} from '../src/middleware/tenant.middleware';

function req(overrides: Record<string, unknown> = {}) {
  return { body: {}, query: {}, headers: {}, ...overrides } as any;
}

beforeEach(() => {
  owned.crmServiceBusiness.findFirst = vi.fn(async () => null);
  owned.crmServiceBusiness.findUnique = vi.fn(async () => null);
});

describe('resolvePlatformBusinessId — server-derived sources only', () => {
  it('rejects a request with no authenticated user', async () => {
    await expect(resolvePlatformBusinessId(req())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('uses the CRM context when present, since it is already ownership-verified', async () => {
    const id = await resolvePlatformBusinessId(
      req({ user: { id: 'u1' }, crm: { businessId: 'biz_ctx', serviceBusinessId: 'csb_1' } }),
    );
    expect(id).toBe('biz_ctx');
    // The cheap path must not hit the database at all — a limit check should not
    // depend on the CRM tables existing.
    expect(owned.crmServiceBusiness.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the verified token', async () => {
    const id = await resolvePlatformBusinessId(req({ user: { id: 'u1', businessId: 'biz_tok' } }));
    expect(id).toBe('biz_tok');
  });

  it('returns null for an authenticated caller with nothing set up, rather than throwing', async () => {
    // The caller decides whether that is a 403 or a fail-closed 402; the resolver just
    // reports the truth.
    const id = await resolvePlatformBusinessId(req({ user: { id: 'u1' } }));
    expect(id).toBeNull();
  });

  // ── The regression these tests exist for ──────────────────────────────────
  it('IGNORES a body businessId entirely', async () => {
    const id = await resolvePlatformBusinessId(
      req({ user: { id: 'u1' }, body: { businessId: 'someone_elses_business' } }),
    );
    expect(id).toBeNull();
  });

  it('IGNORES a query businessId entirely', async () => {
    const id = await resolvePlatformBusinessId(
      req({ user: { id: 'u1' }, query: { businessId: 'someone_elses_business' } }),
    );
    expect(id).toBeNull();
  });

  it('does not let a body id override the authenticated tenant', async () => {
    const id = await resolvePlatformBusinessId(
      req({
        user: { id: 'u1', businessId: 'biz_mine' },
        body: { businessId: 'biz_theirs' },
      }),
    );
    expect(id).toBe('biz_mine');
  });
});

describe('an explicit serviceBusinessId is checked, not trusted', () => {
  it('accepts one the caller owns', async () => {
    owned.crmServiceBusiness.findFirst = vi.fn(async () => ({ id: 'csb_mine', businessId: 'biz_mine' }));
    const id = await resolvePlatformBusinessId(req({ user: { id: 'u1' } }), { serviceBusinessId: 'csb_mine' });
    expect(id).toBe('biz_mine');
    // The ownership predicate is the whole point: id AND ownerId, never id alone.
    expect(owned.crmServiceBusiness.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'csb_mine', ownerId: 'u1' } }),
    );
  });

  it('refuses one the caller does not own', async () => {
    owned.crmServiceBusiness.findFirst = vi.fn(async () => null);
    await expect(
      resolvePlatformBusinessId(req({ user: { id: 'u1' } }), { serviceBusinessId: 'csb_theirs' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('resolveTenant — both identities, named', () => {
  it('returns the platform and service ids together', async () => {
    owned.crmServiceBusiness.findFirst = vi.fn(async () => ({ id: 'csb_1', businessId: 'biz_1' }));
    const tenant = await resolveTenant(req({ user: { id: 'u1', businessId: 'biz_1' } }));
    expect(tenant).toMatchObject({
      businessId: 'biz_1',
      serviceBusinessId: 'csb_1',
      ownerUserId: 'u1',
    });
  });

  it('reports a null platform id honestly for a business with no linked Business row', async () => {
    // This is the state that made POST /invoices/:id/pay throw "businessId must not be
    // null" from inside Prisma. Named here so a caller can refuse with a 409.
    owned.crmServiceBusiness.findFirst = vi.fn(async () => ({ id: 'csb_1', businessId: null }));
    const tenant = await resolveTenant(req({ user: { id: 'u1' } }));
    expect(tenant.businessId).toBeNull();
    expect(tenant.serviceBusinessId).toBe('csb_1');
  });

  it('refuses when the caller has no workspace at all', async () => {
    await expect(resolveTenant(req({ user: { id: 'u1' } }))).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('reading an attached tenant', () => {
  it('requireTenant explains itself when the middleware was not registered', () => {
    expect(() => requireTenant(req())).toThrow(/attachTenant/);
  });

  it('requirePlatformBusinessId gives a 409 rather than letting null reach Prisma', () => {
    const r = req({ tenant: { businessId: null, serviceBusinessId: 'csb_1', ownerUserId: 'u1', source: 'token' } });
    expect(() => requirePlatformBusinessId(r)).toThrow(/linked platform business/);
    try {
      requirePlatformBusinessId(r);
    } catch (e: any) {
      expect(e.statusCode).toBe(409);
    }
  });
});
