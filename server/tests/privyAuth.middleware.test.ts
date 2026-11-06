import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { requirePrivyAuth } from '../src/middleware/privyAuth.middleware';

/**
 * Regression tests for an authentication bypass in requirePrivyAuth.
 *
 * The middleware wrapped its PrivyClient call in `catch {}` and fell through to
 * a path that called jwt.decode() whenever PRIVY_VERIFICATION_KEY was unset.
 * jwt.decode checks exp/iss/aud but never the signature, so a self-signed ES256
 * token carrying iss:'privy.io' and this app's audience was accepted as any
 * user the attacker named in `sub`. Confirmed against the real middleware: a
 * forged token reached next() with an attacker-chosen privyUserId.
 *
 * These tests pin the behaviour so it cannot return: an unverifiable token is
 * a 401, and only a genuinely missing dependency may fall through to the
 * fallback path — never a failed signature check.
 */

function makeForgedToken(sub: string): string {
  // A key the server has never seen. Nothing in the app can verify this.
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return jwt.sign(
    {
      sub,
      iss: 'privy.io',
      aud: process.env.PRIVY_APP_ID || 'some-app-id',
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    privateKey,
    { algorithm: 'ES256' }
  );
}

function makeCall(token: string | null) {
  const req: any = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
  const res: any = {
    code: 0,
    body: undefined as any,
    status(c: number) {
      this.code = c;
      return this;
    },
    json(o: any) {
      this.body = o;
      return this;
    },
  };
  let nexted = false;
  const next = () => {
    nexted = true;
  };
  return { req, res, next, was: () => nexted };
}

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('requirePrivyAuth — forgery resistance', () => {
  it('rejects a self-signed token naming an arbitrary user', async () => {
    // The exact configuration the production deploy would have run with:
    // app ID + secret set, verification key not set.
    process.env.PRIVY_APP_ID = 'cmw59gfa100870gjq9xl1wo99';
    process.env.PRIVY_APP_SECRET = 'privy_app_secret_test';
    delete process.env.PRIVY_VERIFICATION_KEY;

    const { req, res, next, was } = makeCall(makeForgedToken('i-do-not-own-this-account'));

    await requirePrivyAuth(req, res, next);

    expect(was()).toBe(false);
    expect(res.code).toBe(401);
    expect(req.privyUserId).toBeUndefined();
  });

  it('rejects a token whose signature does not match the app key', async () => {
    process.env.PRIVY_APP_ID = 'cmw59gfa100870gjq9xl1wo99';
    process.env.PRIVY_APP_SECRET = 'privy_app_secret_test';
    delete process.env.PRIVY_VERIFICATION_KEY;

    // Well-formed claims, but signed by a key unrelated to Privy's JWKS.
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const token = jwt.sign(
      { sub: 'victim', iss: 'privy.io', aud: process.env.PRIVY_APP_ID, exp: Math.floor(Date.now() / 1000) + 60 },
      privateKey,
      { algorithm: 'ES256' }
    );

    const { req, res, next, was } = makeCall(token);
    await requirePrivyAuth(req, res, next);

    expect(was()).toBe(false);
    expect(res.code).toBe(401);
  });

  it('401s on a missing Authorization header', async () => {
    const { req, res, next, was } = makeCall(null);
    await requirePrivyAuth(req, res, next);
    expect(was()).toBe(false);
    expect(res.code).toBe(401);
    expect(res.body).toEqual({ error: 'Missing token' });
  });

  it('does not accept an expired token', async () => {
    process.env.PRIVY_APP_ID = 'cmw59gfa100870gjq9xl1wo99';
    process.env.PRIVY_APP_SECRET = 'privy_app_secret_test';
    delete process.env.PRIVY_VERIFICATION_KEY;

    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const token = jwt.sign(
      { sub: 'victim', iss: 'privy.io', aud: process.env.PRIVY_APP_ID, exp: Math.floor(Date.now() / 1000) - 300 },
      privateKey,
      { algorithm: 'ES256' }
    );

    const { req, res, next, was } = makeCall(token);
    await requirePrivyAuth(req, res, next);

    expect(was()).toBe(false);
    expect(res.code).toBe(401);
  });

  it('fallback path refuses to verify without PRIVY_VERIFICATION_KEY', async () => {
    // Force the fallback (step 2) by making the package unresolvable, and
    // leave the verification key unset. The old code called jwt.decode() here
    // and accepted the token; it must refuse instead.
    process.env.PRIVY_APP_ID = 'cmw59gfa100870gjq9xl1wo99';
    delete process.env.PRIVY_APP_SECRET;
    delete process.env.PRIVY_VERIFICATION_KEY;

    vi.spyOn(require, 'resolve').mockImplementation(() => {
      const e: NodeJS.ErrnoException = new Error("Cannot find module '@privy-io/server-auth'");
      e.code = 'MODULE_NOT_FOUND';
      throw e;
    });

    const { req, res, next, was } = makeCall(makeForgedToken('attacker'));
    await requirePrivyAuth(req, res, next);

    expect(was()).toBe(false);
    expect(res.code).toBe(401);
  });
});
