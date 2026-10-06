import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Verifiable Credentials — signed with a real keypair, verifiable by a third party.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * `/.well-known/pabandi-keys.json` did this:
 *
 *     crypto.createPublicKey(JWT_SECRET).export({ type: 'spki', format: 'pem' })
 *
 * `createPublicKey` derives a public key from a PRIVATE key; JWT_SECRET is a
 * symmetric HS256 secret, so the call threw and the endpoint had never once
 * returned a key. Credentials were signed with that same secret, which meant the
 * advertised promise — verify a Pabandi credential offline, with a published
 * public key — was not implementable by anyone. It also meant anyone holding the
 * application's signing secret could mint a credential for any passport.
 *
 * WHAT IS ASSERTED HERE
 * ---------------------
 * The property that matters is end-to-end, so it is tested end-to-end:
 *
 *   1. a credential is signed with the ES256 private key
 *   2. the JWKS is read off the LIVE HTTP route, not off the module
 *   3. the credential verifies against that published key, using no application
 *      secret — only what /.well-known/pabandi-keys.json handed out
 *   4. and it does NOT verify against a different key, so the test cannot pass by
 *      accidentally accepting any signature
 *
 * Point 4 matters: a verifier that accepts anything is worse than no verifier,
 * because it looks like verification succeeded.
 */

const { generateKeyPairSync } = crypto;

/** A fresh ES256 keypair per test, so no test can depend on another's key. */
function makeKeypair() {
  return generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
}

let originalKey: string | undefined;
let server: Server | undefined;

beforeEach(() => {
  originalKey = process.env.VC_SIGNING_PRIVATE_KEY;
});

afterEach(async () => {
  if (originalKey === undefined) delete process.env.VC_SIGNING_PRIVATE_KEY;
  else process.env.VC_SIGNING_PRIVATE_KEY = originalKey;
  if (server) {
    await new Promise<void>((r) => server!.close(() => r()));
    server = undefined;
  }
});

/** Boot the real wellknown router and return its base URL. */
async function serveWellKnown(): Promise<string> {
  const { default: router } = await import('../src/routes/wellknown.routes');
  const app = express();
  app.use('/.well-known', router);
  return new Promise<string>((resolve) => {
    const s = app.listen(0, () => {
      server = s;
      const port = (s.address() as AddressInfo).port;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

describe('VC keypair', () => {
  it('publishes a usable EC P-256 public key over HTTP', async () => {
    process.env.VC_SIGNING_PRIVATE_KEY = makeKeypair().privateKey;
    const base = await serveWellKnown();

    const res = await fetch(`${base}/.well-known/pabandi-keys.json`);
    expect(res.status).toBe(200);

    const doc = (await res.json()) as { keys: Array<Record<string, string>> };
    expect(doc.keys).toHaveLength(1);

    const jwk = doc.keys[0];
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.alg).toBe('ES256');
    expect(jwk.use).toBe('sig');
    expect(jwk.kid).toBeTruthy();

    // The previous implementation base64url'd the PEM text into `x` and omitted
    // `y`, so a verifier could not reconstruct a key. Both affine coordinates
    // must be present and must decode to 32 bytes — the length of a P-256 point
    // coordinate. A PEM-derived blob would decode to something else entirely.
    expect(jwk.x).toBeTruthy();
    expect(jwk.y).toBeTruthy();
    expect(Buffer.from(jwk.x, 'base64url')).toHaveLength(32);
    expect(Buffer.from(jwk.y, 'base64url')).toHaveLength(32);
  });

  it('never publishes private key material', async () => {
    process.env.VC_SIGNING_PRIVATE_KEY = makeKeypair().privateKey;
    const base = await serveWellKnown();

    const body = await (await fetch(`${base}/.well-known/pabandi-keys.json`)).text();

    expect(body).not.toContain('PRIVATE');
    expect(body).not.toContain('BEGIN');
    // `d` is the private scalar in a JWK. It must not be present in any form.
    const doc = JSON.parse(body) as { keys: Array<Record<string, string>> };
    expect(doc.keys[0].d).toBeUndefined();
  });

  it('verifies a signed credential against ONLY the published key', async () => {
    const { privateKey } = makeKeypair();
    process.env.VC_SIGNING_PRIVATE_KEY = privateKey;
    const base = await serveWellKnown();

    const { signVerifiableCredential } = await import('../src/trust/vcKeys');
    const credential = signVerifiableCredential(
      { sub: 'passport_1', handle: 'apex-builders', scores: { showUp: 820 } },
      3600,
    );

    // Fetch the JWKS the way a third party would, over HTTP.
    const jwksDoc = (await (await fetch(`${base}/.well-known/pabandi-keys.json`)).json()) as {
      keys: Array<crypto.JsonWebKey>;
    };
    const publicKey = crypto.createPublicKey({ key: jwksDoc.keys[0], format: 'jwk' });

    // The application secret is not involved anywhere in this verification.
    const decoded = jwt.verify(credential, publicKey, { algorithms: ['ES256'] }) as {
      sub: string;
      handle: string;
    };
    expect(decoded.sub).toBe('passport_1');
    expect(decoded.handle).toBe('apex-builders');
  });

  it('refuses a credential signed by a different key', async () => {
    // The negative case. Without it, a verifier that accepted any ES256 signature
    // would pass the test above and tell users their credentials were valid when
    // they were not.
    process.env.VC_SIGNING_PRIVATE_KEY = makeKeypair().privateKey;
    const base = await serveWellKnown();

    const { signVerifiableCredential } = await import('../src/trust/vcKeys');
    const impostor = signVerifiableCredential({ sub: 'passport_forged' }, 3600);
    // Re-sign the same claims with a key the server never published.
    const forged = jwt.sign({ sub: 'passport_forged' }, makeKeypair().privateKey, {
      algorithm: 'ES256',
      expiresIn: 3600,
    });

    const jwksDoc = (await (await fetch(`${base}/.well-known/pabandi-keys.json`)).json()) as {
      keys: Array<crypto.JsonWebKey>;
    };
    const publicKey = crypto.createPublicKey({ key: jwksDoc.keys[0], format: 'jwk' });

    expect(() => jwt.verify(forged, publicKey, { algorithms: ['ES256'] })).toThrow();
    expect(jwt.decode(impostor)).toBeTruthy();
  });

  it('refuses to sign at all when no key is configured', async () => {
    // No development fallback. A hardcoded fallback secret would recreate the
    // original vulnerability in a more convenient form: a working endpoint whose
    // credentials anyone in the world could forge.
    delete process.env.VC_SIGNING_PRIVATE_KEY;
    const { signVerifiableCredential, vcSigningConfigured } = await import('../src/trust/vcKeys');

    expect(vcSigningConfigured()).toBe(false);
    expect(() => signVerifiableCredential({ sub: 'x' }, 3600)).toThrow(/VC_SIGNING_PRIVATE_KEY/);
  });

  it('answers 503 rather than a misleading key when unconfigured', async () => {
    // Returning 200 with a broken or empty JWKS would tell a verifier that
    // verification is available when it is not.
    delete process.env.VC_SIGNING_PRIVATE_KEY;
    const base = await serveWellKnown();

    const res = await fetch(`${base}/.well-known/pabandi-keys.json`);
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('accepts a PEM stored with escaped newlines, as env vars actually carry it', async () => {
    // This is the form every real deployment ends up with. An environment
    // variable cannot reliably hold real newlines across dotenv, Render, Docker
    // and CI secrets, so the PEM arrives with literal \n sequences. Verified
    // because the failure mode is silent otherwise: the variable is set, the
    // length looks right, and createPrivateKey fails with an OpenSSL DECODER
    // error that never mentions the env var.
    const { privateKey } = makeKeypair();
    process.env.VC_SIGNING_PRIVATE_KEY = privateKey.trim().replace(/\n/g, '\\n');
    expect(process.env.VC_SIGNING_PRIVATE_KEY).not.toContain('\n');

    const base = await serveWellKnown();
    const res = await fetch(`${base}/.well-known/pabandi-keys.json`);
    expect(res.status).toBe(200);

    const { signVerifiableCredential } = await import('../src/trust/vcKeys');
    const credential = signVerifiableCredential({ sub: 'passport_env' }, 3600);

    const jwksDoc = (await (await fetch(`${base}/.well-known/pabandi-keys.json`)).json()) as {
      keys: Array<crypto.JsonWebKey>;
    };
    const publicKey = crypto.createPublicKey({ key: jwksDoc.keys[0], format: 'jwk' });
    const decoded = jwt.verify(credential, publicKey, { algorithms: ['ES256'] }) as { sub: string };
    expect(decoded.sub).toBe('passport_env');
  });

  it('rejects a key that is not a readable PEM, naming the variable', async () => {
    process.env.VC_SIGNING_PRIVATE_KEY = 'not-a-pem';
    const { vcPublicJwk } = await import('../src/trust/vcKeys');

    expect(() => vcPublicJwk()).toThrow(/VC_SIGNING_PRIVATE_KEY/);
  });

  it('rejects a symmetric key, since ES256 requires an EC keypair', async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    process.env.VC_SIGNING_PRIVATE_KEY = privateKey;
    const { vcPublicJwk } = await import('../src/trust/vcKeys');

    expect(() => vcPublicJwk()).toThrow(/ES256|EC key/i);
  });
});