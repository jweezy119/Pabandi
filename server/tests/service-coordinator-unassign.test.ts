import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest';

/**
 * Route-level guarantees on the Service Coordinator's unassign endpoint.
 *
 * This endpoint exists because Undo has to be a real revert: dismissing a
 * confirmation strip leaves the assignment on the server and the technician
 * notified. So the assertions here are about the gates around it —
 * authentication, idempotency, and who is allowed to remove a technician —
 * rather than about the handler's behaviour, which needs a live database.
 *
 * Same approach as route-authorization.test.ts: read the middleware stack off
 * the Express router. A behavioural test would need a signed JWT and a seeded
 * tenant; the middleware stack reaches the same property with the router alone.
 */

/**
 * Importing the router drags in its whole service graph, and some of those
 * services register pollers at module scope. Wrap setInterval while the import
 * happens and clear every handle afterwards, so this worker does not stay alive
 * receiving console writes after the assertions are over.
 */
const createdIntervals: NodeJS.Timeout[] = [];
const realSetInterval = globalThis.setInterval.bind(globalThis);

beforeAll(() => {
  globalThis.setInterval = ((fn: any, ms?: number, ...args: any[]) => {
    const handle = realSetInterval(fn as any, ms as any, ...args);
    createdIntervals.push(handle);
    return handle;
  }) as typeof globalThis.setInterval;
});

afterAll(async () => {
  globalThis.setInterval = realSetInterval;
  for (const handle of createdIntervals) clearInterval(handle);
  createdIntervals.length = 0;
  await new Promise((resolve) => setImmediate(resolve));
});

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const ROUTE = '/work-orders/:id/unassign';

function captureResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader() {
      return this;
    },
  };
}

function routeLayer(router: any, method: string, path: string): any {
  const layer = router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method],
  );
  if (!layer) throw new Error(`no route for ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((s: any) => s.handle);
}

/** Router-level middleware (`router.use(...)`) rather than per-route layers. */
function routerLevelNames(router: any): string[] {
  return router.stack
    .filter((l: any) => !l.route)
    .map((l: any) => l.handle?.name || '<anonymous>');
}

/**
 * Invokes one middleware layer the way Express would, with a user of the given
 * role, and reports whether it let the request through.
 */
async function invoke(handle: any, user: Record<string, unknown>) {
  const res = captureResponse();
  const next = vi.fn();
  await handle(
    {
      user,
      params: { id: 'wo-1425' },
      method: 'POST',
      originalUrl: `/api/v1/coordinator${ROUTE.replace(':id', 'wo-1425')}`,
      headers: {},
    },
    res,
    next,
  );
  return { res, next };
}

describe('Service Coordinator — unassign route', () => {
  let router: any;

  beforeEach(async () => {
    vi.resetModules();
    router = (await import('../src/routes/serviceCoordinator.routes')).default;
  });

  it('is registered', () => {
    expect(() => routeLayer(router, 'post', ROUTE)).not.toThrow();
  });

  it('sits behind router-level authentication', () => {
    expect(routerLevelNames(router)).toContain('authenticate');
  });

  it('carries the idempotency middleware, so a retried Undo is safe', () => {
    const names = routeLayer(router, 'post', ROUTE).map((h: any) => h.name || '<anonymous>');
    expect(names).toContain('idempotency');
  });

  it('lets an OWNER through', async () => {
    const layer = routeLayer(router, 'post', ROUTE).find(
      (h: any) => h.name === '' || h.name === 'middleware',
    );
    const { next } = await invoke(layer, { id: 'u1', role: 'OWNER', businessId: 'biz1' });
    expect(next).toHaveBeenCalled();
  });

  it('lets a COORDINATOR through', async () => {
    const layer = routeLayer(router, 'post', ROUTE).find(
      (h: any) => h.name === '' || h.name === 'middleware',
    );
    const { next } = await invoke(layer, { id: 'u2', role: 'COORDINATOR', businessId: 'biz1' });
    expect(next).toHaveBeenCalled();
  });

  it('refuses a TECHNICIAN — undoing a dispatch is not a technician action', async () => {
    const layer = routeLayer(router, 'post', ROUTE).find(
      (h: any) => h.name === '' || h.name === 'middleware',
    );
    const { res, next } = await invoke(layer, {
      id: 'u3',
      role: 'TECHNICIAN',
      businessId: 'biz1',
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('refuses a request with no tenant in the session', async () => {
    const layer = routeLayer(router, 'post', ROUTE).find(
      (h: any) => h.name === '' || h.name === 'middleware',
    );
    const { res, next } = await invoke(layer, { id: 'u4', role: 'OWNER', businessId: null });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
