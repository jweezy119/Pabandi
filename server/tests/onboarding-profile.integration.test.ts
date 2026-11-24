import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * POST /api/v1/auth/onboarding — the first-run profile choice.
 *
 * WHY THIS FILE EXISTS
 * There are TWO onboarding endpoints in this codebase:
 *
 *   /api/v1/onboarding/complete  (onboarding.routes.ts) — `{ profile, services,
 *                                  availability, employees }`, well tested
 *   /api/v1/auth/onboarding      (auth.controller.ts)  — `{ profileType,
 *                                  businessName, industry }`, which is what the
 *                                  live `/onboarding` page (OnboardingPage)
 *                                  actually calls — and which had NO test.
 *
 * So the covered endpoint was not the shipped one. Picking "Service Business"
 * on the real site wrote `activeMode: UserRole.BUSINESS_OWNER` into a column
 * typed as the `UserMode` enum (`CUSTOMER | BUSINESS | FREELANCER`), Prisma
 * threw `Invalid value for argument 'activeMode'`, and the raw error was
 * rendered on screen. A brand-new business owner could not finish signing up —
 * the single most important conversion step, broken.
 *
 * The other two profiles passed only by coincidence: `UserRole.CUSTOMER` is the
 * string `"CUSTOMER"`, which happens to be a valid `UserMode`.
 */

function assertIsolatedDatabase() {
  const url = process.env.DATABASE_URL || '';
  let name = '';
  try {
    name = new URL(url).pathname.replace(/^\//, '');
  } catch {
    /* handled below */
  }
  if (!/test|integration|ci/i.test(name)) {
    throw new Error(
      `Refusing to run integration tests against database "${name || '<unknown>'}"\n` +
        'These tests create real rows. Point DATABASE_URL at a disposable database ' +
        'whose name contains "test".',
    );
  }
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const MARKER = '@ob.pabandi.dev';
let baseUrl = '';
let server: Server;

async function api(method: string, path: string, body?: unknown, token = '') {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep null */
  }
  return { status: res.status, json };
}

let seq = 0;
async function register(): Promise<{ token: string; email: string }> {
  seq += 1;
  const email = `ob${seq}${MARKER}`;
  const res = await api('POST', '/api/v1/auth/register', {
    email,
    password: 'Probe!2026pass',
    firstName: 'Probe',
    lastName: 'Owner',
  });
  expect(res.status, JSON.stringify(res.json)).toBe(201);
  return { token: (res.json.data as any).token as string, email };
}

/** `activeMode` is deliberately not in the endpoint's response select, so read
 *  the stored value — which is also what every other query filters on. */
async function stored(email: string) {
  const { prisma } = await import('../src/utils/database');
  const row = await prisma.user.findUnique({
    where: { email },
    select: { activeMode: true, preferredMode: true, role: true, profileType: true },
  });
  return row;
}

describe('first-run profile selection', () => {
  beforeAll(async () => {
    assertIsolatedDatabase();
    const { default: app } = await import('../src/app');
    server = app.listen(0);
    await new Promise<void>((r) => server.once('listening', () => r()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 180_000);

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    const { prisma } = await import('../src/utils/database');
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const { prisma } = await import('../src/utils/database');
    // Business.owner is optional (SetNull): deleting the user leaves the
    // business and its @unique slug behind, so remove both.
    await prisma.business.deleteMany({ where: { owner: { email: { contains: MARKER } } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('completes SERVICE_BUSINESS onboarding instead of throwing', async () => {
    const { token, email } = await register();

    const res = await api(
      'POST',
      '/api/v1/auth/onboarding',
      { profileType: 'SERVICE_BUSINESS', businessName: 'Probe Plumbing', industry: 'commercial' },
      token,
    );

    // Before the fix this was a 500 carrying Prisma's
    // "Invalid value for argument `activeMode`. Expected UserMode."
    expect(res.status, JSON.stringify(res.json)).toBe(200);

    const user = (res.json.data as any).user;
    expect(user.role).toBe('BUSINESS_OWNER');
    expect(user.preferredMode).toBe('business');
    expect(user.business?.name).toBe('Probe Plumbing');

    // The reissued token must carry the new mode, or the next screen reads the
    // pre-onboarding claims and routes the user back to onboarding.
    expect(String((res.json.data as any).token).split('.')).toHaveLength(3);

    const row = await stored(email);
    expect(row?.activeMode).toBe('BUSINESS');
    expect(row?.profileType).toBe('SERVICE_BUSINESS');
  });

  it('maps every profile onto a legal UserMode', async () => {
    const cases = [
      ['CLIENT', 'CUSTOMER', 'personal'],
      ['SOLO_BUILDER', 'FREELANCER', 'personal'],
      ['SERVICE_BUSINESS', 'BUSINESS', 'business'],
    ] as const;

    for (const [profileType, activeMode, preferredMode] of cases) {
      const { token, email } = await register();
      const res = await api(
        'POST',
        '/api/v1/auth/onboarding',
        { profileType, businessName: `${profileType} Co`, industry: 'general' },
        token,
      );
      expect(res.status, `${profileType}: ${JSON.stringify(res.json)}`).toBe(200);

      const row = await stored(email);
      expect(row?.activeMode, profileType).toBe(activeMode);
      expect(row?.preferredMode, profileType).toBe(preferredMode);
    }
  });

  it('rejects an unknown profileType rather than writing a bad mode', async () => {
    const { token } = await register();
    const res = await api('POST', '/api/v1/auth/onboarding', { profileType: 'WIZARD' }, token);
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await api('POST', '/api/v1/auth/onboarding', {
      profileType: 'SERVICE_BUSINESS',
      businessName: 'X',
    });
    expect(res.status).toBe(401);
  });
});
