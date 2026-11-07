import crypto from 'node:crypto';
import { TrustBandEvaluation } from './privyTrustScoring';
import { getAttestationKeyBundle } from './signedAttestation.service';

/**
 * Year-0 Pragmatic Extraction — Piece 3: Selective Disclosure Credentials (W3C VC + SD-JWT)
 *
 * Implements IETF OAuth SD-JWT (Selective Disclosure for JWTs, RFC-draft) + W3C VC Data Model
 * using standard SHA-256 salted disclosures and Ed25519 signatures (`node:crypto`).
 *
 * Why SD-JWT now instead of BBS+:
 *   - Solves counterparty selective disclosure today (holders can reveal `trust_band: 'A'`
 *     or `score_gte_75: true` without revealing their exact score, link count, or raw PII).
 *   - Zero native/WASM pairing library dependencies, sub-millisecond issuance and verification,
 *     and standard `header.payload.signature~disclosure1~disclosure2~` wire format.
 */

export interface SdJwtDisclosureItem {
  salt: string;
  claimName: string;
  claimValue: string | number | boolean;
  encoded: string;
  digest: string;
}

export interface IssuedSdJwtCredential {
  /** Complete SD-JWT containing all disclosures: `<jwt>~<d1>~<d2>~...~` */
  sdJwtFull: string;
  /** Minimal presentation disclosing ONLY `trust_band` and `zero_deposit_eligible` */
  minimalPresentation: string;
  issuerJwt: string;
  disclosures: Record<string, SdJwtDisclosureItem>;
  keyId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface VerifiedSdJwtResult {
  valid: boolean;
  subject?: string;
  issuer?: string;
  issuedAt?: number;
  expiresAt?: number;
  disclosedClaims?: Record<string, string | number | boolean>;
  reason?: string;
}

function sha256Base64Url(input: string): string {
  return crypto.createHash('sha256').update(input, 'ascii').digest('base64url');
}

function createSaltedDisclosure(
  claimName: string,
  claimValue: string | number | boolean,
  customSalt?: string
): SdJwtDisclosureItem {
  const salt = customSalt || crypto.randomBytes(16).toString('base64url');
  const jsonArray = JSON.stringify([salt, claimName, claimValue]);
  const encoded = Buffer.from(jsonArray, 'utf8').toString('base64url');
  const digest = sha256Base64Url(encoded);
  return {
    salt,
    claimName,
    claimValue,
    encoded,
    digest,
  };
}

/**
 * Issues a W3C-aligned SD-JWT Trust Credential for a scored user.
 *
 * Selectively disclosable claims:
 *   - `trust_band`: 'A' | 'B' | 'C' | 'D'
 *   - `zero_deposit_eligible`: boolean (Band A)
 *   - `low_deposit_eligible`: boolean (Band A or B)
 *   - `score_gte_75`: boolean
 *   - `score_gte_55`: boolean
 *   - `exact_score`: number
 *   - `total_links`: number
 *   - `phishing_resistant_verified`: boolean
 */
export function issueSdJwtTrustCredential(params: {
  subjectId: string;
  evaluation: TrustBandEvaluation;
  ttlSeconds?: number;
}): IssuedSdJwtCredential {
  const { subjectId, evaluation, ttlSeconds = 7 * 24 * 3600 } = params;
  const keyBundle = getAttestationKeyBundle();

  const claimsToProtect: Record<string, string | number | boolean> = {
    trust_band: evaluation.band,
    zero_deposit_eligible: evaluation.band === 'A',
    low_deposit_eligible: evaluation.band === 'A' || evaluation.band === 'B',
    score_gte_75: evaluation.score >= 75,
    score_gte_55: evaluation.score >= 55,
    exact_score: evaluation.score,
    total_links: evaluation.totalLinks,
    phishing_resistant_verified: evaluation.hasPhishingResistant,
  };

  const disclosures: Record<string, SdJwtDisclosureItem> = {};
  const sdDigests: string[] = [];

  for (const [name, value] of Object.entries(claimsToProtect)) {
    const item = createSaltedDisclosure(name, value);
    disclosures[name] = item;
    sdDigests.push(item.digest);
  }

  // Add 2 decoy digests so an observer cannot infer how many claims exist when some are omitted
  for (let i = 0; i < 2; i++) {
    sdDigests.push(sha256Base64Url(crypto.randomBytes(32).toString('base64url')));
  }

  // Sort _sd digests lexicographically per IETF SD-JWT spec so order leaks no metadata
  sdDigests.sort();

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + ttlSeconds;

  const header = {
    alg: 'EdDSA',
    typ: 'vc+sd-jwt',
    kid: keyBundle.keyId,
  };

  const subjectDid = subjectId.startsWith('did:')
    ? subjectId
    : `did:pabandi:${crypto.createHash('sha256').update(subjectId).digest('hex').slice(0, 24)}`;

  const payload = {
    iss: 'https://pabandi.com/iam',
    sub: subjectDid,
    iat: nowSec,
    exp: expSec,
    vct: 'https://pabandi.com/credentials/TrustPassportCredential/v1',
    _sd_alg: 'sha-256',
    _sd: sdDigests,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .sign(null, Buffer.from(signingInput, 'utf8'), keyBundle.privateKey)
    .toString('base64url');

  const issuerJwt = `${signingInput}.${signature}`;
  const allEncoded = Object.values(disclosures)
    .map((d) => d.encoded)
    .join('~');
  const sdJwtFull = `${issuerJwt}~${allEncoded}~`;

  // Minimal privacy-preserving presentation: discloses ONLY trust_band and zero_deposit_eligible
  const minimalEncoded = [
    disclosures.trust_band.encoded,
    disclosures.zero_deposit_eligible.encoded,
    disclosures.score_gte_75.encoded,
  ].join('~');
  const minimalPresentation = `${issuerJwt}~${minimalEncoded}~`;

  return {
    sdJwtFull,
    minimalPresentation,
    issuerJwt,
    disclosures,
    keyId: keyBundle.keyId,
    issuedAt: new Date(nowSec * 1000).toISOString(),
    expiresAt: new Date(expSec * 1000).toISOString(),
  };
}

/**
 * Creates a custom selective presentation from an issued SD-JWT containing only the requested claim names.
 */
export function selectSdJwtClaims(
  credential: IssuedSdJwtCredential,
  claimNamesToReveal: string[]
): string {
  const selected = claimNamesToReveal
    .map((name) => credential.disclosures[name]?.encoded)
    .filter((v): v is string => Boolean(v));
  return selected.length > 0
    ? `${credential.issuerJwt}~${selected.join('~')}~`
    : `${credential.issuerJwt}~`;
}

/**
 * Verifies an SD-JWT presentation (`<jwt>~<d1>~<d2>~`), checks the Ed25519 signature,
 * checks expiration, and matches every presented disclosure against the signed `_sd` digests.
 */
export function verifySdJwtPresentation(presentation: string): VerifiedSdJwtResult {
  try {
    if (!presentation || typeof presentation !== 'string') {
      return { valid: false, reason: 'Empty SD-JWT presentation' };
    }

    const parts = presentation.split('~');
    const issuerJwt = parts[0];
    const disclosureStrings = parts.slice(1).filter((p) => p.length > 0);

    const jwtSegments = issuerJwt.split('.');
    if (jwtSegments.length !== 3) {
      return { valid: false, reason: 'Malformed issuer JWT in SD-JWT presentation' };
    }

    const [encodedHeader, encodedPayload, encodedSig] = jwtSegments;
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const keyBundle = getAttestationKeyBundle();
    const isSigValid = crypto.verify(
      null,
      Buffer.from(signingInput, 'utf8'),
      keyBundle.publicKey,
      Buffer.from(encodedSig, 'base64url')
    );

    if (!isSigValid) {
      return { valid: false, reason: 'Invalid Ed25519 signature on SD-JWT issuer token' };
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      iss?: string;
      sub?: string;
      iat?: number;
      exp?: number;
      _sd?: string[];
      _sd_alg?: string;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && nowSec > payload.exp) {
      return { valid: false, reason: 'SD-JWT credential has expired' };
    }

    const sdSet = new Set(Array.isArray(payload._sd) ? payload._sd : []);
    const disclosedClaims: Record<string, string | number | boolean> = {};

    for (const rawDisclosure of disclosureStrings) {
      const digest = sha256Base64Url(rawDisclosure);
      if (!sdSet.has(digest)) {
        return {
          valid: false,
          reason: 'Presented disclosure digest does not match any signed _sd commitment',
        };
      }

      const parsed = JSON.parse(Buffer.from(rawDisclosure, 'base64url').toString('utf8')) as unknown;
      if (!Array.isArray(parsed) || parsed.length !== 3 || typeof parsed[1] !== 'string') {
        return { valid: false, reason: 'Malformed disclosure tuple' };
      }

      const claimName = parsed[1];
      const claimValue = parsed[2] as string | number | boolean;
      disclosedClaims[claimName] = claimValue;
    }

    return {
      valid: true,
      subject: payload.sub,
      issuer: payload.iss,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
      disclosedClaims,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : 'Failed to parse SD-JWT presentation',
    };
  }
}
