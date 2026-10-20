import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import { resolve } from 'node:path';

/**
 * Selective disclosure, and what it deliberately does not contain.
 *
 * The existing credential endpoint (`GET /trust/credential/:passportId`) publishes the
 * exact scores across five dimensions, includes the passport's handle and displayName,
 * is unauthenticated, and is called by nothing. It is a disclosure surface, not a
 * disclosure.
 *
 * This is the opposite design. The band credential asserts one coarse fact and is
 * constructed so that everything it does not need is never written into it.
 *
 * ── THE HONEST FRAMING ───────────────────────────────────────────────────────
 *
 * This is NOT a zero-knowledge proof, and the tests do not pretend it is. An ES256
 * credential is readable by anyone who holds it; nothing about it is secret after
 * issuance. What it provides is selective disclosure — the score is not encrypted or
 * hidden inside the credential, it is simply not in it.
 *
 * The privacy comes from never writing the score down, which is a stronger guarantee
 * than hiding it, and it is achievable with standard, widely-verifiable technology. A
 * real ZK circuit proving score >= 70 without the score existing anywhere public would
 * be better engineering, and is not something to hand-roll alongside a payment system.
 */

process.env.VC_SIGNING_PRIVATE_KEY = '';
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
process.env.VC_SIGNING_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

vi.mock('../../src/utils/database', () => ({
  prisma: { crmClient: { findFirst: vi.fn() } },
}));
vi.mock('../../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { prisma } from '../../src/utils/database';
import {
  mintTrustDisclosure,
  verifyTrustDisclosure,
  bandFor,
  TRUST_BANDS,
} from '../../src/trust/disclosure.service';

const CLIENT = 'cli_1';
const SVC = 'svc_1';
const PASSPORT = 'passport_abc';

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.crmClient.findFirst as any).mockResolvedValue({
    id: CLIENT, passportId: PASSPORT, reliabilityScore: 84,
  });
});

function mint(overrides = {}) {
  return mintTrustDisclosure({
    clientId: CLIENT,
    serviceBusinessId: SVC,
    audienceBusinessId: 'biz_recipient',
    baseUrl: 'https://pabandi.com',
    ...overrides,
  });
}

const claims = (credential: string) => jwt.decode(credential) as Record<string, any>;

describe('what the credential discloses', () => {
  it('asserts a band and nothing finer', async () => {
    // The whole-serialisation scan is the honest check — the score must be
    // written NOWHERE, not absent from a claim list — but the token also
    // carries an iat, an exp, and a timestamped jti, and all three are real
    // numbers that at some wall-clock moment contain the substring. To a
    // substring scan a timestamp matching the score is indistinguishable from
    // a leak. Freezing the clock makes the scan a statement about the minting
    // code, not about what time it is; the frozen epoch, its base-36 jti, and
    // its exp are all digit-clean of '84' by construction.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T10:30:00.000Z'));
    try {
      const { credential } = await mint();
      const payload = claims(credential);

      expect(payload.pab.trustBand).toBe('TOP');
      expect(payload.pab.bandLabel).toBe('80–100');
      // The number itself must not appear anywhere in the token.
      const serialised = JSON.stringify(payload);
      expect(serialised).not.toContain('84');
    } finally {
      vi.useRealTimers();
    }
  });

  it('contains no identifying claim at all', async () => {
    const { credential } = await mint();
    const payload = claims(credential);

    for (const forbidden of [
      'name', 'email', 'phone', 'handle', 'displayName',
      'clientId', 'passportId', 'businessId', 'wallet',
    ]) {
      expect(Object.keys(payload)).not.toContain(forbidden);
    }
    expect(JSON.stringify(payload)).not.toContain(PASSPORT);
    expect(JSON.stringify(payload)).not.toContain(CLIENT);
  });

  it('never exposes a score under any other name', async () => {
    const { credential } = await mint();
    const serialised = JSON.stringify(claims(credential));
    // The 0-1000 passport scores and the canonical 0-100 one are the same class of
    // leak whichever name it travels under.
    for (const forbidden of ['score', 'reliability', 'payment', 'delivery', 'showUp', 'tenancy']) {
      expect(serialised.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('uses an opaque subject that is not the passport id', async () => {
    const { credential } = await mint();
    expect(claims(credential).sub).not.toBe(PASSPORT);
    expect(claims(credential).sub.length).toBeGreaterThan(20);
  });

  it('gives the same subject to the same person every time, so we can correlate', async () => {
    // Stability is what makes the pseudonym useful to the ISSUER and useless to
    // everyone else. If it rotated per credential it would also break replay checks.
    const a = await mint();
    const b = await mint();
    expect(claims(a.credential).sub).toBe(claims(b.credential).sub);
  });

  it('scopes the credential to one audience', async () => {
    const { credential } = await mint();
    expect(claims(credential).aud).toBe('biz_recipient');
  });

  it('expires', async () => {
    const { credential, expiresAt } = await mint();
    expect(claims(credential).exp).toBeTruthy();
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('verifying, without any access to us', () => {
  it('accepts an authentic credential', async () => {
    const { credential } = await mint();
    const result = verifyTrustDisclosure(credential);
    expect(result.valid).toBe(true);
    expect(result.band).toBe('TOP');
  });

  it('answers the question the verifier actually has', async () => {
    const { credential } = await mint();

    expect(verifyTrustDisclosure(credential, { threshold: 70 }).meetsThreshold).toBe(true);
    // Below the band, the answer is no — and the verifier never learns why in numbers.
    expect(verifyTrustDisclosure(credential, { threshold: 90 }).meetsThreshold).toBe(false);
  });

  it('rejects a credential minted for a different business', async () => {
    const { credential } = await mint();
    const result = verifyTrustDisclosure(credential, { audienceBusinessId: 'biz_someone_else' });
    // Without this check a client could hand one proof to anyone and it would work
    // everywhere, which is the opposite of audience scoping.
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/different business/i);
  });

  it('accepts it for the business it was made for', async () => {
    const { credential } = await mint();
    expect(
      verifyTrustDisclosure(credential, { audienceBusinessId: 'biz_recipient' }).valid,
    ).toBe(true);
  });

  it('rejects a forged credential', async () => {
    const { credential } = await mint();
    const tampered = credential.slice(0, -4) + 'AAAA';
    expect(verifyTrustDisclosure(tampered).valid).toBe(false);
  });

  it('rejects one signed by a different key', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const forged = jwt.sign(
      { iss: 'https://pabandi.com', pab: { trustBand: 'TOP' }, exp: Math.floor(Date.now() / 1000) + 3600 },
      other.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      { algorithm: 'ES256' },
    );
    expect(verifyTrustDisclosure(forged).valid).toBe(false);
  });

  it('rejects an expired credential', async () => {
    const expired = jwt.sign(
      {
        iss: 'https://pabandi.com',
        sub: 'x',
        pab: { trustBand: 'TOP' },
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      (privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() as string),
      { algorithm: 'ES256' },
    );
    expect(verifyTrustDisclosure(expired).valid).toBe(false);
    expect(verifyTrustDisclosure(expired).reason).toMatch(/expired/i);
  });

  it('rejects something that is not a disclosure at all', async () => {
    const notOurs = jwt.sign({ hello: 'world' }, 'secret', { algorithm: 'HS256' });
    expect(verifyTrustDisclosure(notOurs).valid).toBe(false);
  });

  it('gives one message for every cryptographic failure', async () => {
    // Forged, malformed and wrong-key all collapse together. Telling an attacker
    // which attempt got further is the thing not to leak; neither outcome is
    // actionable by a legitimate verifier.
    const wrongKey = jwt.sign(
      { pab: { trustBand: 'TOP' }, exp: Math.floor(Date.now() / 1000) + 3600 },
      generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey
        .export({ type: 'pkcs8', format: 'pem' }).toString(),
      { algorithm: 'ES256' },
    );

    const reasons = new Set([
      verifyTrustDisclosure('garbage').reason,
      verifyTrustDisclosure(wrongKey).reason,
      verifyTrustDisclosure((await mint()).credential.slice(0, -4) + 'AAAA').reason,
    ]);
    expect(reasons.size).toBe(1);
  });

  it('still names expiry, because that one is actionable', () => {
    // Expiry is readable in the token the verifier was handed, so distinguishing it
    // discloses nothing — and "ask for a fresh one" is the only useful answer.
    const expired = jwt.sign(
      { pab: { trustBand: 'TOP' }, exp: Math.floor(Date.now() / 1000) - 60 },
      privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      { algorithm: 'ES256' },
    );
    expect(verifyTrustDisclosure(expired).reason).toMatch(/expired/i);
  });
});

describe('bands', () => {
  it('is monotone and covers the whole scale', () => {
    expect(bandFor(100).id).toBe('TOP');
    expect(bandFor(84).id).toBe('TOP');
    expect(bandFor(80).id).toBe('TOP');
    expect(bandFor(79).id).toBe('ESTABLISHED');
    expect(bandFor(50).id).toBe('STEADY');
    expect(bandFor(40).id).toBe('DEVELOPING');
    expect(bandFor(0).id).toBe('EARLY');
  });

  it('clamps out-of-range scores rather than banding nothing', () => {
    expect(bandFor(500).id).toBe('TOP');
    expect(bandFor(-20).id).toBe('EARLY');
  });

  it('returns a low band rather than no answer', () => {
    // "Below 40" is an answer a verifier can act on. Silence would be worse.
    expect(TRUST_BANDS.some((b) => b.id === bandFor(12).id)).toBe(true);
  });
});

describe('minting refuses what it cannot attest to', () => {
  it('will not mint for a client with no passport', async () => {
    (prisma.crmClient.findFirst as any).mockResolvedValue({
      id: CLIENT, passportId: null, reliabilityScore: 90,
    });
    await expect(mint()).rejects.toThrow(/no trust passport/i);
  });

  it('will not mint for another tenant', async () => {
    (prisma.crmClient.findFirst as any).mockResolvedValue(null);
    await expect(mint()).rejects.toThrow(/not found/i);
  });
});
