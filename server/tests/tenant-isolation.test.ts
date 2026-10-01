import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate } from '../src/middleware/auth.middleware';
import { tenantContext } from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';

/**
 * Tenant isolation guards.
 *
 * The bug being locked down: `authenticate` attached the raw decoded JWT to
 * `req.user` and populated an AsyncLocalStorage tenant context, but no route
 * ever read that context. Every CRM handler instead took `businessId` from the
 * query string or body and used it as the only tenant predicate, so any
 * authenticated user could read or write another business's data by passing
 * their id.
 *
 * These tests cover the two properties the fix depends on: the token is the
 * authoritative tenant, and the tenant context is actually populated so it can
 * be read.
 */

const SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = SECRET;

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: { authorization: '' },
    ...overrides,
  } as never;
}

function captureResponse() {
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res as unknown as Response & { body?: unknown };
}

describe('authenticate — tenant binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request with no Authorization header', () => {
    const req = makeRequest();
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, captureResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  it('rejects a malformed token', () => {
    const req = makeRequest({ headers: { authorization: 'Bearer not-a-jwt' } });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, captureResponse(), next);

    const err = (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  it('exposes the tenant from a current token as businessId', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.c', role: 'USER', businessId: 'biz_1' }, SECRET);
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, captureResponse(), next);

    const authed = req as unknown as { user?: { businessId?: string } };
    expect(authed.user?.businessId).toBe('biz_1');
  });

  it('normalises the legacy activeBusinessId claim to businessId', () => {
    // Tokens issued before the claim was renamed still carry activeBusinessId.
    // If these were not normalised, every holder of an old token would resolve
    // to no tenant and every CRM call would 403.
    const token = jwt.sign({ id: 'u1', email: 'a@b.c', role: 'USER', activeBusinessId: 'biz_legacy' }, SECRET);
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, captureResponse(), next);

    const authed = req as unknown as { user?: { businessId?: string } };
    expect(authed.user?.businessId).toBe('biz_legacy');
  });

  it('populates the tenant context so it is readable downstream', () => {
    // The context is set but was never read by any route. This asserts it is
    // actually available inside the next() call, which is what a route would
    // need in order to scope a query.
    const token = jwt.sign({ id: 'u1', email: 'a@b.c', role: 'USER', businessId: 'biz_ctx' }, SECRET);
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });

    let seen: string | null = null;
    const next = vi.fn(() => {
      seen = tenantContext.getStore()?.businessId ?? null;
    }) as unknown as NextFunction;

    authenticate(req, captureResponse(), next);

    expect(seen).toBe('biz_ctx');
  });

  it('leaves the tenant context unset for a personal-only account', () => {
    // A user with no business must not inherit a tenant from anywhere; their
    // CRM calls should be refused with 403, not silently scoped to someone.
    const token = jwt.sign({ id: 'u2', email: 'p@b.c', role: 'USER' }, SECRET);
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });

    let store: { businessId: string } | undefined;
    const next = vi.fn(() => {
      store = tenantContext.getStore();
    }) as unknown as NextFunction;

    authenticate(req, captureResponse(), next);

    expect(store).toBeUndefined();
    const authed = req as unknown as { user?: { businessId?: string } };
    expect(authed.user?.businessId).toBeUndefined();
  });

  it('keeps the account mode on the request so guards can read it', () => {
    const token = jwt.sign({ id: 'u3', email: 'm@b.c', role: 'USER', businessId: 'b', mode: 'personal' }, SECRET);
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, captureResponse(), next);

    const authed = req as unknown as { user?: { mode?: string } };
    expect(authed.user?.mode).toBe('personal');
  });
});
