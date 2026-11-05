import crypto from 'crypto';
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { logger } from './logger';

export type TrustBand = 'A' | 'B' | 'C' | 'D' | 'E';
export type PrincipalType = 'human' | 'agent';

export interface IamTokenClaims {
  sub: string;
  iss: string;
  aud: string;
  scope?: string;
  trust_score: number;
  trust_band: TrustBand;
  principal_type: PrincipalType;
  delegation_max_spend_cents: number;
  jkt?: string;
  name?: string;
  email?: string;
  wallet_address?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface JwkPublicKey {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

// Generate or initialize the RSA 2048 keypair for OIDC signing
let privateKeyPem: string;
let publicKeyPem: string;
let cachedJwk: JwkPublicKey;

const KEY_ID = 'pabandi-iam-v1';
const ISSUER = 'https://pabandi.com';

function initializeKeys() {
  try {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    privateKeyPem = privateKey;
    publicKeyPem = publicKey;

    // Export JWK representation
    const keyObject = crypto.createPublicKey(publicKey);
    const jwk = keyObject.export({ format: 'jwk' });

    cachedJwk = {
      kty: jwk.kty || 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: KEY_ID,
      n: jwk.n || '',
      e: jwk.e || 'AQAB',
    };

    logger.info('[Pabandi IAM] Initialized RS256 OIDC signing keys with kid: ' + KEY_ID);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[Pabandi IAM] Failed to initialize RSA keys: ' + msg);
    throw err;
  }
}

// Initialize immediately on module load
initializeKeys();

/**
 * Returns the public JWKS document for /.well-known/jwks.json
 */
export function getJwks(): { keys: JwkPublicKey[] } {
  return {
    keys: [cachedJwk],
  };
}

/**
 * Convert a trust score (0-100) into a Trust Band ('A' - 'E')
 */
export function scoreToTrustBand(score: number): TrustBand {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'E';
}

/**
 * Sign an OIDC token with standard and trust claims
 */
export function signOidcToken(
  claims: Omit<IamTokenClaims, 'iss'>,
  options?: { expiresIn?: string | number }
): string {
  const isAgent = claims.principal_type === 'agent';
  // Capability leases for agents must never exceed 15 minutes (900 seconds)
  const defaultExpiry = isAgent ? '15m' : '1h';
  const expiresIn = options?.expiresIn || defaultExpiry;

  const payload: IamTokenClaims = {
    ...claims,
    iss: ISSUER,
  };

  const signOptions: SignOptions = {
    algorithm: 'RS256',
    keyid: KEY_ID,
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, privateKeyPem, signOptions);
}

/**
 * Verify an incoming OIDC / Trust Band JWT
 */
export function verifyOidcToken(token: string): IamTokenClaims {
  const verifyOptions: VerifyOptions = {
    algorithms: ['RS256'],
    issuer: ISSUER,
  };

  return jwt.verify(token, publicKeyPem, verifyOptions) as IamTokenClaims;
}

/**
 * Compute the JWK Thumbprint (RFC 7638) of a public key in base64url format
 * Used for DPoP token binding (jkt confirmation claim)
 */
export function calculateJwkThumbprint(jwk: Record<string, unknown>): string {
  // RFC 7638 canonical JSON representation:
  // For RSA: e, kty, n
  // For EC: crv, kty, x, y
  // For OKP (Ed25519): crv, kty, x
  let canonicalJson: string;

  const kty = String(jwk.kty);
  if (kty === 'RSA') {
    canonicalJson = JSON.stringify({
      e: jwk.e,
      kty: jwk.kty,
      n: jwk.n,
    });
  } else if (kty === 'EC') {
    canonicalJson = JSON.stringify({
      crv: jwk.crv,
      kty: jwk.kty,
      x: jwk.x,
      y: jwk.y,
    });
  } else if (kty === 'OKP') {
    canonicalJson = JSON.stringify({
      crv: jwk.crv,
      kty: jwk.kty,
      x: jwk.x,
    });
  } else {
    // Fallback: sorted keys
    const sortedKeys = Object.keys(jwk).sort();
    const sortedObj: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      sortedObj[k] = jwk[k];
    }
    canonicalJson = JSON.stringify(sortedObj);
  }

  const hash = crypto.createHash('sha256').update(canonicalJson).digest();
  return hash.toString('base64url');
}
