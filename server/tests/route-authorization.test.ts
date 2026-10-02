import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Route-level authorisation on the money endpoints.
 *
 * These are assertions about which routes carry which middleware, not about
 * behaviour. The reason they exist is that every hole fixed here was invisible
 * to the test suite: the routes returned 401 without a token (because
 * `authenticate` was present) while being completely open to *any* logged-in
 * user. A behavioural test needs a live database and a signed JWT to reach that
 * state; reading the middleware stack off the Express router reaches it with
 * nothing but the router itself.
 *
 * Each assertion states the reason so a future edit that drops the gate
 * explains itself rather than just failing.
 */

const SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = SECRET;

/** Middleware layers on a route, innermost last. */
function layersFor(router: any, method: string, path: string): any[] {
  const layer = router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method],
  );
  if (!layer) throw new Error(`no route for ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((s: any) => s.handle);
}

function namesFor(router: any, method: string, path: string): string[] {
  return layersFor(router, method, path).map((h: any) => h.name || '<anonymous>');
}

/**
 * Whether a route has a role gate, detected by behaviour rather than by name.
 *
 * `authorize('ADMIN')` returns an anonymous arrow, so its `.name` is
 * `<anonymous>` and matching on a name would not work. Instead each unnamed
 * layer is invoked with a CUSTOMER user: a role gate rejects that with a 403,
 * and anything else passes it through. That is the property actually worth
 * asserting — the route refuses a non-admin — rather than a proxy for it.
 */
function hasRoleGate(router: any, method: string, path: string, deniedRole = 'CUSTOMER'): boolean {
  for (const handle of layersFor(router, method, path)) {
    if (handle?.name !== '') continue;
    const res = captureResponse();
    const next = vi.fn();
    handle({ user: { id: 'u1', role: deniedRole } }, res, next);
    const err = next.mock.calls[0]?.[0];
    if (err?.statusCode === 403) return true;
  }
  return false;
}

function captureResponse() {
  const res = {
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
  };
  return res;
}

function requiresAuth(router: any, method: string, path: string): boolean {
  return namesFor(router, method, path).includes('authenticate');
}

describe('COD escrow — party ownership and third-party resolution', () => {
  // Every route here acts on an escrow named by the caller, so a token alone
  // let any user drive anyone else's contract: release it, refund it, ship it.
  let router: any;

  beforeEach(async () => {
    vi.resetModules();
    router = (await import('../src/routes/codEscrow.routes')).default;
  });

  const allRoutes: Array<[string, string]> = [
    ['post', '/:id/pay'],
    ['post', '/:id/ship'],
    ['post', '/:id/deliver'],
    ['post', '/:id/release'],
    ['post', '/:id/dispute'],
    ['post', '/:id/resolve'],
    ['get', '/:id'],
  ];

  it('requires authentication on every escrow-addressed route', () => {
    for (const [method, path] of allRoutes) {
      expect(requiresAuth(router, method, path)).toBe(true);
    }
  });

  it('restricts dispute resolution to admins, not to the parties', () => {
    // The point of a dispute is that neither side may pick the outcome. Buyer
    // would choose RELEASE, seller would choose REFUND, so party-gating this
    // would reproduce the original bug with an extra step.
    expect(hasRoleGate(router, 'post', '/:id/resolve')).toBe(true);
    expect(hasRoleGate(router, 'post', '/:id/dispute')).toBe(false);
  });

  it('does not let the seller release the escrow to themselves', () => {
    // Only asserted at the middleware level: the party check lives in the
    // handler. releaseFunds in the service now also requires DELIVERED, so
    // neither the seller nor the buyer can release while goods are in transit.
    expect(requiresAuth(router, 'post', '/:id/release')).toBe(true);
    expect(hasRoleGate(router, 'post', '/:id/release')).toBe(false);
  });
});

describe('economy — treasury writes are admin-only, quotes are not', () => {
  let router: any;

  beforeEach(async () => {
    vi.resetModules();
    router = (await import('../src/routes/economy.routes')).default;
  });

  const adminOnly: Array<[string, string]> = [
    // charge-rake and sol-checkout both write a PENDING_CHARGE treasury row
    // for a caller-supplied payer and amount. confirm-rake then flips that row
    // to DEPLOYED after finding *a* valid on-chain tx — without checking the
    // tx belongs to that charge. Gating the confirms is what stops a user
    // minting a charge and declaring it settled against an unrelated signature.
    ['post', '/charge-rake'],
    ['post', '/confirm-rake'],
    ['post', '/route-yield'],
    ['post', '/confirm-yield'],
    ['post', '/demo-book'],
  ];

  it.each(adminOnly)('requires ADMIN for %s %s', (method, path) => {
    expect(requiresAuth(router, method, path)).toBe(true);
    expect(hasRoleGate(router, method, path)).toBe(true);
  });

  it('leaves quotes and reads open to any authenticated user', () => {
    // A price quote does not need to be privileged to be useful, and gating it
    // would break the checkout flow it exists to serve.
    for (const path of ['/quote-rake', '/quote-yield']) {
      expect(requiresAuth(router, 'post', path)).toBe(true);
      expect(hasRoleGate(router, 'post', path)).toBe(false);
    }
    // sol-checkout stays open deliberately: it is the real customer SOL payment
    // path, not a treasury operation.
    expect(requiresAuth(router, 'post', '/sol-checkout')).toBe(true);
    expect(hasRoleGate(router, 'post', '/sol-checkout')).toBe(false);
  });

  it('keeps the leaderboard and referral handle public and unauthenticated', () => {
    expect(requiresAuth(router, 'get', '/leaderboard')).toBe(false);
    expect(requiresAuth(router, 'get', '/referral/:code')).toBe(false);
  });
});

describe('treasury — sweep is admin, fiat-deposit is signed', () => {
  let router: any;

  beforeEach(async () => {
    vi.resetModules();
    router = (await import('../src/routes/treasury.autonomous.routes')).default;
  });

  it('requires ADMIN to sweep funds to a caller-supplied wallet', () => {
    expect(requiresAuth(router, 'post', '/sweep')).toBe(true);
    expect(hasRoleGate(router, 'post', '/sweep')).toBe(true);
  });

  it('requires ADMIN to run the demo flow', () => {
    expect(hasRoleGate(router, 'post', '/demo-flow')).toBe(true);
  });

  it('does not authenticate fiat-deposit, because it verifies a signature instead', () => {
    // The fix here is an HMAC over the raw body, not a session. Adding
    // `authenticate` on top would be redundant for a banking partner and would
    // mean the endpoint could never be called by one.
    expect(requiresAuth(router, 'post', '/webhooks/fiat-deposit')).toBe(false);
  });
});

describe('single wallet treasury — declarations are not proofs', () => {
  let router: any;

  beforeEach(async () => {
    vi.resetModules();
    router = (await import('../src/routes/singleWalletTreasury.routes')).default;
  });

  it('requires ADMIN for every write', () => {
    // Each writes a treasuryPosition with a caller-supplied amount and
    // status CONFIRMED — the exact pair getBucketBalance sums. An ordinary
    // user could therefore move the reported operating balance by typing a
    // number, with no funds and nothing to reconcile.
    for (const path of ['/fund', '/recycle', '/reserve']) {
      expect(requiresAuth(router, 'post', path)).toBe(true);
      expect(hasRoleGate(router, 'post', path)).toBe(true);
    }
  });

  it('gates the balance breakdown, which exposes treasury totals', () => {
    expect(hasRoleGate(router, 'get', '/breakdown')).toBe(true);
  });

  it('leaves the platform wallet address readable', () => {
    // Public by design — a deposit address has to be publishable to be useful.
    expect(requiresAuth(router, 'get', '/address')).toBe(true);
    expect(hasRoleGate(router, 'get', '/address')).toBe(false);
  });
});

describe('settlement — the manual trigger is admin-only', () => {
  let router: any;

  beforeEach(async () => {
    vi.resetModules();
    router = (await import('../src/routes/settlement.routes')).default;
  });

  it('requires ADMIN to run settlement', () => {
    // runSettlement marks every CLAIMED-but-unsettled reward settled in one
    // updateMany — irreversible, and already scheduled hourly.
    expect(requiresAuth(router, 'post', '/run')).toBe(true);
    expect(hasRoleGate(router, 'post', '/run')).toBe(true);
  });

  it('leaves status readable by any authenticated user', () => {
    expect(requiresAuth(router, 'get', '/status')).toBe(true);
    expect(hasRoleGate(router, 'get', '/status')).toBe(false);
  });
});

describe('the endpoints fixed earlier are still gated', () => {
  // Regression cover: these were the first pass, and a later refactor that
  // dropped a gate would otherwise go unnoticed because the whole file would
  // still look "authenticated".
  it('keeps the payout migration admin-only', async () => {
    vi.resetModules();
    const router = (await import('../src/routes/payout.routes')).default;
    expect(requiresAuth(router, 'post', '/migrate')).toBe(true);
    expect(hasRoleGate(router, 'post', '/migrate')).toBe(true);
  });

  it('keeps escrow mutations authenticated', async () => {
    vi.resetModules();
    const router = (await import('../src/routes/escrow.routes')).default;
    expect(requiresAuth(router, 'post', '/')).toBe(true);
    expect(requiresAuth(router, 'patch', '/:referenceId/status')).toBe(true);
  });
});