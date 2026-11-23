import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Email-code login.
 *
 * WHY THIS FILE EXISTS
 * Passwordless login shipped without any server-side test — only a client
 * component test asserted the UI calls the endpoints. Everything that matters
 * lives on the server: the code is generated and stored here, emailed from
 * here, and exchanged for a JWT here. A regression in any of those would leave
 * every passwordless user unable to sign in, and nothing in CI would notice.
 *
 * Two properties are asserted beyond the happy path, because they are the ones
 * that were missing:
 *
 *  - ACCOUNT LOCKOUT. The password path locks an account after five failures.
 *    The code path had no such thing, so a six-digit code was protected only by
 *    a per-IP limiter — which a distributed attacker walks around. Five wrong
 *    guesses now lock the account for fifteen minutes.
 *
 *  - NO ACCOUNT ENUMERATION. `/request-code` used to answer `isNewUser`, which
 *    tells anyone whether an address has an account. The flag is gone.
 */

// Real emails must never leave a test run. The controller imports the service
// lazily inside the handler, so mocking the module is what intercepts it.
vi.mock('../src/services/email.service', () => ({
  emailService: {
    sendVerificationEmail: vi.fn(async () => ({ id: 'test-message-id' })),
  },
}));

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
// The global limiter is not the concern here; the auth-specific limiters have
// their own fixed budgets. Raise this so a long file is never cut short by it.
process.env.RATE_LIMIT_MAX_REQUESTS = process.env.RATE_LIMIT_MAX_REQUESTS || '100000';

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
        'These tests write and delete real rows. Point DATABASE_URL at a disposable ' +
        'database whose name contains "test".',
    );
  }
  return name;
}

let baseUrl: string;
let server: Server;

const MARKER = '@code.pabandi.dev';

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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

/** The code the user would have received. Read from the database rather than the
 *  mocked sender, so the test asserts the value that was actually stored. */
async function storedCode(email: string): Promise<string> {
  const { prisma } = await import('../src/utils/database');
  const user = await prisma.user.findUnique({
    where: { email },
    select: { verificationCode: true, failedLoginAttempts: true, accountLockedUntil: true },
  });
  return user?.verificationCode ?? '';
}

describe('email code login', () => {
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
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('issues a working code for an unknown email, without saying it is new', async () => {
    const email = `new${MARKER}`;
    const requested = await api('POST', '/api/v1/auth/request-code', { email });
    expect(requested.status, JSON.stringify(requested.json)).toBe(200);

    // Account enumeration: the response must not reveal whether the address
    // already had an account.
    expect(JSON.stringify(requested.json)).not.toContain('isNewUser');

    const code = await storedCode(email);
    expect(code, 'a code must be stored for the user').toHaveLength(6);

    const verified = await api('POST', '/api/v1/auth/verify-code', { email, code });
    expect(verified.status, JSON.stringify(verified.json)).toBe(200);
    expect(verified.json.data.token, 'a code login must return a session token').toBeTruthy();
    expect(verified.json.data.refreshToken).toBeTruthy();

    // The code is single-use.
    const replay = await api('POST', '/api/v1/auth/verify-code', { email, code });
    expect(replay.status).toBe(400);
  });

  it('locks the account after five wrong guesses', async () => {
    const email = `locked${MARKER}`;
    await api('POST', '/api/v1/auth/request-code', { email });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await api('POST', '/api/v1/auth/verify-code', {
        email,
        code: '000000',
      });
      expect(res.status, `attempt ${attempt}: ${JSON.stringify(res.json)}`).toBe(400);
    }

    // The sixth guess is refused by the lockout, not by the code check.
    const locked = await api('POST', '/api/v1/auth/verify-code', { email, code: '000000' });
    expect(locked.status, JSON.stringify(locked.json)).toBe(403);
    expect(String(locked.json?.message ?? '')).toMatch(/locked/i);

    const { prisma } = await import('../src/utils/database');
    const user = await prisma.user.findUnique({
      where: { email },
      select: { failedLoginAttempts: true, accountLockedUntil: true },
    });
    expect(user?.accountLockedUntil, 'the lock must be recorded').toBeTruthy();

    // Even the CORRECT code is refused while locked — the lock is on the
    // account, not on the guessing.
    await prisma.user.update({
      where: { email },
      data: { verificationCode: '999999', verificationCodeExpires: new Date(Date.now() + 60_000) },
    });
    const correctWhileLocked = await api('POST', '/api/v1/auth/verify-code', {
      email,
      code: '999999',
    });
    expect(correctWhileLocked.status).toBe(403);
  });

  it('clears the lockout counters on a successful login', async () => {
    const email = `reset${MARKER}`;
    await api('POST', '/api/v1/auth/request-code', { email });

    await api('POST', '/api/v1/auth/verify-code', { email, code: '000000' });
    await api('POST', '/api/v1/auth/verify-code', { email, code: '000000' });

    const { prisma } = await import('../src/utils/database');
    const before = await prisma.user.findUnique({
      where: { email },
      select: { failedLoginAttempts: true },
    });
    expect(before?.failedLoginAttempts).toBe(2);

    const code = await storedCode(email);
    const verified = await api('POST', '/api/v1/auth/verify-code', { email, code });
    expect(verified.status).toBe(200);

    const after = await prisma.user.findUnique({
      where: { email },
      select: { failedLoginAttempts: true, accountLockedUntil: true },
    });
    expect(after?.failedLoginAttempts).toBe(0);
    expect(after?.accountLockedUntil).toBeNull();
  });

  it('answers 400 rather than 500 when required fields are missing', async () => {
    // All three of these returned a bare 500 in production on an empty body:
    // the missing value reached Prisma as `email: undefined`, which throws.
    for (const path of ['/api/v1/auth/register', '/api/v1/auth/login']) {
      const res = await api('POST', path, {});
      expect(res.status, `${path}: ${JSON.stringify(res.json)}`).toBe(400);
    }

    // forgot-password deliberately answers as though it succeeded, so a
    // malformed request neither 500s nor reveals whether the address exists.
    const forgot = await api('POST', '/api/v1/auth/forgot-password', {});
    expect(forgot.status).toBe(200);
    expect(String(forgot.json?.message)).toMatch(/reset link/i);
  });

  it('refuses to say whether a code is valid for an email with no code', async () => {
    const email = `nocode${MARKER}`;
    await api('POST', '/api/v1/auth/request-code', { email });
    const { prisma } = await import('../src/utils/database');
    await prisma.user.update({
      where: { email },
      data: { verificationCode: null, verificationCodeExpires: null },
    });

    const res = await api('POST', '/api/v1/auth/verify-code', { email, code: '123456' });
    expect(res.status, JSON.stringify(res.json)).toBe(400);
  });
});
