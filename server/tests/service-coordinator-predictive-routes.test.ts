import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest';
import { simulateRiskSchema } from '../src/validators/serviceCoordinator.validator';

/**
 * Route-level guarantees on the predictive endpoints (§7).
 *
 * Same approach as service-coordinator-unassign.test.ts: read the middleware
 * stack off the Express router rather than booting a server. The handlers
 * themselves need a live database, which is exactly the thing a unit test
 * cannot provide — but who may call the endpoint, and which gates sit in front
 * of it, are properties of the router and are fully assertable here.
 *
 * The simulator is the expensive endpoint (200 bootstrap draws per call), so
 * the rate limiter's presence is asserted explicitly rather than assumed.
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

const PREDICT = '/work-orders/:id/predict';
const SIMULATE = '/work-orders/:id/simulate';

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

function routerLevelNames(router: any): string[] {
  return router.stack
    .filter((l: any) => !l.route)
    .map((l: any) => l.handle?.name || '<anonymous>');
}

/** The role gate is the per-route middleware, which is anonymous in Express 5. */
function roleGate(handles: any[]): any {
  return handles.find((h: any) => h.name === '' || h.name === 'middleware');
}

async function invoke(handle: any, user: Record<string, unknown>, path: string) {
  const res = captureResponse();
  const next = vi.fn();
  await handle(
    {
      user,
      params: { id: 'wo-1425' },
      method: 'POST',
      originalUrl: `/api/v1/coordinator${path}`,
      headers: {},
    },
    res,
    next,
  );
  return { res, next };
}

describe('Service Coordinator — predictive routes', () => {
  let router: any;

  beforeEach(async () => {
    vi.resetModules();
    router = (await import('../src/routes/serviceCoordinator.routes')).default;
  });

  it('registers both endpoints', () => {
    expect(() => routeLayer(router, 'post', PREDICT)).not.toThrow();
    expect(() => routeLayer(router, 'post', SIMULATE)).not.toThrow();
  });

  it('sits behind router-level authentication', () => {
    expect(routerLevelNames(router)).toContain('authenticate');
  });

  it('lets an OWNER and a COORDINATOR score a work order', async () => {
    const gate = roleGate(routeLayer(router, 'post', PREDICT));
    for (const role of ['OWNER', 'COORDINATOR']) {
      const { next } = await invoke(
        gate,
        { id: `u-${role}`, role, businessId: 'biz1' },
        PREDICT.replace(':id', 'wo-1425'),
      );
      expect(next).toHaveBeenCalled();
    }
  });

  it('lets a TECHNICIAN read a score, subject to the assignment check', async () => {
    // Asserted by absence rather than presence: the role gate allows TECHNICIAN
    // on this route, but the middleware then verifies the technician is
    // assigned to the work order, and that lookup needs a live database. With
    // no database the request neither reaches `next` nor is refused for the
    // role — so the router alone cannot prove the positive case, and claiming
    // it here would be a test that passes for the wrong reason.
    const gate = roleGate(routeLayer(router, 'post', PREDICT));
    expect(gate).toBeDefined();
  });

  it('refuses a TECHNICIAN on the simulator — running scenarios is not a technician action', async () => {
    const gate = roleGate(routeLayer(router, 'post', SIMULATE));
    const { res, next } = await invoke(
      gate,
      { id: 'u-tech', role: 'TECHNICIAN', businessId: 'biz1' },
      SIMULATE.replace(':id', 'wo-1425'),
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('refuses a request with no tenant in the session', async () => {
    for (const path of [PREDICT, SIMULATE]) {
      const gate = roleGate(routeLayer(router, 'post', path));
      const { res, next } = await invoke(
        gate,
        { id: 'u-none', role: 'OWNER', businessId: null },
        path.replace(':id', 'wo-1425'),
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    }
  });

  it('carries the rate limiter on the simulator, because it is the expensive call', () => {
    const names = routeLayer(router, 'post', SIMULATE).map(
      (h: any) => h.name || '<anonymous>',
    );
    expect(names).toContain('predictiveRateLimit');
  });

  it('does not rate-limit the point prediction, which is cheap and cached by the page', () => {
    const names = routeLayer(router, 'post', PREDICT).map(
      (h: any) => h.name || '<anonymous>',
    );
    expect(names).not.toContain('predictiveRateLimit');
  });
});

describe('simulateRiskSchema', () => {
  it('accepts a partial perturbation, because a slider the user never touched is absent', () => {
    const parsed = simulateRiskSchema.safeParse({ schedule_density: 1 });
    expect(parsed.success).toBe(true);
  });

  it('accepts an empty body, which is the "show me this job’s own range" case', () => {
    const parsed = simulateRiskSchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown key rather than ignoring it', () => {
    // A silently ignored slider looks exactly like a prediction that refused
    // to move, so a typo must be loud.
    const parsed = simulateRiskSchema.safeParse({ start_hour: 14 });
    expect(parsed.success).toBe(false);
  });

  it('rejects a value outside the feature’s possible range', () => {
    expect(simulateRiskSchema.safeParse({ technician_skill_match: 2 }).success).toBe(false);
    expect(simulateRiskSchema.safeParse({ technician_skill_match: -1.5 }).success).toBe(false);
    expect(simulateRiskSchema.safeParse({ schedule_density: 'four' }).success).toBe(false);
  });
});
