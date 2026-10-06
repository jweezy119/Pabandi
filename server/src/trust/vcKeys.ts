/**
 * vcKeys.ts — asymmetric signing for Pabandi Verifiable Credentials.
 *
 * WHAT WAS BROKEN
 * ---------------
 * `/.well-known/pabandi-keys.json` did this:
 *
 *     crypto.createPublicKey(JWT_SECRET).export({ type: 'spki', format: 'pem' })
 *
 * `createPublicKey` derives a public key from a PRIVATE key. JWT_SECRET is a
 * symmetric HS256 secret, not a keypair, so this throws for every real deployment
 * — the endpoint had never returned a key. The credentials it was supposed to let
 * anyone verify were signed with the same HS256 secret, which means:
 *
 *   - no third party could verify a credential, because there was no public key
 *     to verify it with;
 *   - "verify offline" was never true, because verification required the signing
 *     secret itself;
 *   - anyone holding JWT_SECRET could mint credentials for any passport.
 *
 * The published `x` was also not a coordinate at all — it was a base64url of the
 * PEM text, with `crv: secp256k1` (which pairs with ES256-k, not ES256). A
 * verifier that took those fields at face value could not have used them even if
 * the endpoint had worked.
 *
 * WHAT THIS DOES INSTEAD
 * ----------------------
 * ES256 (ECDSA on P-256 / prime256v1) over a keypair whose private half lives in
 * VC_SIGNING_PRIVATE_KEY and whose public half is derived on demand. The JWKS is
 * generated from the private key at request time rather than committed, so the
 * published key and the signing key cannot drift apart — the same reason
 * `/.well-known/agents.json` derives its base_url from the request.
 *
 * SETUP
 * -----
 * Generate a keypair and put ONLY the private half in the environment:
 *
 *     openssl ecparam -name prime256v1 -genkey -noout \
 *       | openssl pkcs8 -topk8 -nocrypt -out vc-private.pem
 *
 * Then, as a single line for your secret store (the \n are literal, and MUST be
 * preserved — a PEM with real newlines will not fit an env var cleanly):
 *
 *     node -e "const p=require('fs').readFileSync('vc-private.pem','utf8').trim(); \
 *       console.log('VC_SIGNING_PRIVATE_KEY=' + JSON.stringify(p))"
 *
 * Or generate it straight into .env, which is gitignored:
 *
 *     node -e "const c=require('crypto');const{f=pem}=c.generateKeyPairSync('ec', \
 *       {namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'}, \
 *        publicKeyEncoding:{type:'spki',format:'pem'}}); \
 *       console.log('VC_SIGNING_PRIVATE_KEY=' + JSON.stringify(pem.trim()))"
 *
 * There is deliberately NO development fallback secret. Signing a trust
 * credential with a hardcoded key would recreate the original vulnerability in a
 * more convenient form, and `requireVcPrivateKey` throws at call time so the
 * failure names the missing variable instead of surfacing as a 500 from deep
 * inside jsonwebtoken.
 */

import { createPrivateKey } from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

/** ES256 is ECDSA on P-256. `secp256k1` would be ES256-k, which no verifier expects. */
export const VC_SIGNING_ALG = 'ES256' as const;
export const VC_KEY_ID = 'pabandi-vc-1';

export interface VcPublicJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  alg: typeof VC_SIGNING_ALG;
  use: 'sig';
  kid: typeof VC_KEY_ID;
}

/**
 * Read the private key, or throw a message that says what to do about it.
 *
 * Lazy, not module scope: `tests/setup-env.ts` and a deployment both need to set
 * the variable before the first read but not before the import. `ptp.spec.ts`
 * established this pattern for PTP_SIGNING_SECRET, and the same reasoning holds —
 * an import-time read turns a missing-key error into a failure to even start.
 */
export function requireVcPrivateKeyPem(): string {
  const raw = process.env.VC_SIGNING_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error(
      'VC_SIGNING_PRIVATE_KEY is not set. Verifiable credentials cannot be signed without it. ' +
        'Generate an ES256 keypair with: openssl ecparam -name prime256v1 -genkey -noout ' +
        '| openssl pkcs8 -topk8 -nocrypt -out vc-private.pem — then set the variable to the PEM.',
    );
  }

  // A PEM is multi-line, and an environment variable cannot hold real newlines in
  // every deployment path (dotenv, Render, Docker, CI secrets all differ). The
  // universal workaround is to store the PEM with literal \n sequences and decode
  // them here. Without this, a key that looks correctly configured fails to parse
  // with an OpenSSL DECODER error that gives no hint the env var is the problem.
  const pem = raw.includes('\\n') && !raw.includes('\n') ? raw.replace(/\\n/g, '\n') : raw;

  // Fail here rather than inside jsonwebtoken, which reports a malformed key as a
  // generic sign failure with no indication that the environment is the problem.
  try {
    createPrivateKey(pem);
  } catch (err) {
    throw new Error(
      `VC_SIGNING_PRIVATE_KEY is not a readable PEM private key: ${err instanceof Error ? err.message : 'unknown error'}. ` +
        'It must be the PKCS#8 PEM body (-----BEGIN PRIVATE KEY-----), with newlines either real or as \\n, ' +
        'and not a JWK or a file path.',
    );
  }
  return pem;
}

/**
 * The public half, as a real EC JWK.
 *
 * An EC private key exported in JWK form already carries the public point as
 * `x` and `y` — the private scalar `d` sits alongside it. So the public key is
 * read straight off the private key object rather than round-tripped through
 * `createPublicKey`, whose signature does not accept a KeyObject.
 *
 * `x` and `y` are the base64url affine coordinates of the point on P-256, which
 * is what a JWK consumer parses. The previous implementation base64url'd the PEM
 * text into `x` and omitted `y` entirely, so no verifier could reconstruct a key
 * from it.
 */
export function vcPublicJwk(): VcPublicJwk {
  const jwk = createPrivateKey(requireVcPrivateKeyPem()).export({ format: 'jwk' });
  if (jwk.kty !== 'EC' || !jwk.x || !jwk.y) {
    throw new Error(
      `VC_SIGNING_PRIVATE_KEY must be an EC key on the P-256 curve for ${VC_SIGNING_ALG}; ` +
        `got kty=${jwk.kty}. Generate with "openssl ecparam -name prime256v1 -genkey".`,
    );
  }
  return {
    kty: 'EC',
    crv: 'P-256',
    x: jwk.x,
    y: jwk.y,
    alg: VC_SIGNING_ALG,
    use: 'sig',
    kid: VC_KEY_ID,
  };
}

/** The document served at /.well-known/pabandi-keys.json. */
export function vcJwks(): { keys: VcPublicJwk[] } {
  return { keys: [vcPublicJwk()] };
}

/** Sign a credential payload. The algorithm is pinned, never inferred from the key. */
export function signVerifiableCredential(
  payload: Record<string, unknown>,
  expiresInSeconds: number,
): string {
  const pem = requireVcPrivateKeyPem();
  // algorithm is explicit rather than left to jsonwebtoken's inference: inference
  // picks from the key type, and pinning it means a key swapped in the environment
  // cannot quietly change how credentials are signed.
  return jwt.sign(payload, pem, { algorithm: VC_SIGNING_ALG, expiresIn: expiresInSeconds });
}

/** True when the environment can sign credentials, for startup diagnostics. */
export function vcSigningConfigured(): boolean {
  try {
    vcPublicJwk();
    return true;
  } catch {
    return false;
  }
}

/** Logged at boot so a missing key is noticed before a user requests a credential. */
export function warnIfVcSigningUnconfigured(): void {
  if (!vcSigningConfigured()) {
    logger.warn(
      '[vcKeys] VC_SIGNING_PRIVATE_KEY is not configured — GET /api/v1/trust/credential/:passportId ' +
        'and /.well-known/pabandi-keys.json will fail until it is set. Generate one with: ' +
        'openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt',
    );
  }
}