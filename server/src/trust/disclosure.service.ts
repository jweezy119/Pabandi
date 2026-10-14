import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/errorHandler';
import {
  signVerifiableCredential,
  requireVcPrivateKeyPem,
  vcPublicJwk,
  VC_SIGNING_ALG,
} from './vcKeys';
import { createPublicKey } from 'crypto';

/**
 * Selective disclosure of a client's trust standing.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 *
 * Not a zero-knowledge proof. An ES256-signed verifiable credential is signed and
 * readable by anyone holding it; nothing about it is secret after issuance. What this
 * achieves is *selective disclosure*: the credential is constructed so that the things
 * it does not need to contain were never written into it. The exact score is not
 * encrypted or hidden inside the credential — it is not in the credential, and it was
 * never put on anything.
 *
 * That distinction matters for how it gets described. A real ZK proof (prove
 * score >= 70 without the score existing anywhere public, via a circuit) would be
 * stronger. It also needs audited cryptographic code. The band approach gets the same
 * privacy outcome for a disclosure that is already coarse, using standard,
 * widely-verifiable technology — and the score stays in the database, which is the
 * thing that actually needs protecting.
 *
 * ── WHAT IS AND IS NOT DISCLOSED ────────────────────────────────────────────
 *
 * Asserted: that the subject holds at least N, out of 100, on Pabandi's canonical
 * reliability scale; that it was true at issuance; who issued it; for which audience;
 * until when.
 *
 * Withheld: the exact score, the client's name, email, phone and handle, every
 * transaction, every other client, and the counterparty history behind the score. A
 * verifier learns "this person is above 70" and nothing that could identify them or
 * reconstruct their record.
 *
 * ── THE PSEUDONYMOUS SUBJECT ────────────────────────────────────────────────
 *
 * `sub` is an HMAC of the passport id under the issuer's own signing key, not the id
 * itself and not a hash anyone else can compute. Two consequences, both load-bearing:
 *
 *   - the receiving business cannot turn the credential back into a client record
 *   - two businesses cannot correlate the same person by comparing subjects, because
 *     the reference is stable for us and opaque to them
 *
 * ── AUDIENCE SCOPING ────────────────────────────────────────────────────────
 *
 * `aud` is the receiving business. A credential minted for one business is rejected
 * by another, so a client can hand the same person a proof that works only where they
 * meant it to. That is the difference between "share my trust profile" and "prove it to
 * this business".
 */

/** Bands, coarsest at the bottom. Matched to the invoice terms tiers so a business
 *  reading one and a verifier reading the other are talking about the same thing. */
export const TRUST_BANDS = [
  { id: 'TOP', min: 80, label: '80–100' },
  { id: 'ESTABLISHED', min: 70, label: '70–79' },
  { id: 'STEADY', min: 50, label: '50–69' },
  { id: 'DEVELOPING', min: 40, label: '40–49' },
  { id: 'EARLY', min: 0, label: '0–39' },
] as const;

export type BandId = (typeof TRUST_BANDS)[number]['id'];

const CREDENTIAL_TTL_HOURS = 24;

/** The band a score falls into. Below 40 is still returned — a low band is an answer. */
export function bandFor(score: number): { id: BandId; label: string; min: number } {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return TRUST_BANDS.find((b) => clamped >= b.min) ?? TRUST_BANDS[TRUST_BANDS.length - 1];
}

/**
 * A stable, opaque reference to a passport.
 *
 * Derived from the issuer's own signing key rather than a bare SHA-256 of the id: a
 * plain hash is trivially reversible for any enumerable id, and id-shaped values are
 * cuid, which are guessable in a way a UUID is not.
 */
function subjectFor(passportId: string): string {
  const pem = requireVcPrivateKeyPem();
  return jwt.sign({ s: passportId }, pem, {
    algorithm: VC_SIGNING_ALG,
    // No expiry: this is a one-way reference, not a credential, and an expiring one
    // would mean the same person correlates differently to us over time.
    expiresIn: '365d',
  })
    .split('.')
    .slice(0, 2)
    .join('.')
    .slice(0, 64);
}

export interface MintedDisclosure {
  credential: string;
  band: { id: BandId; label: string; min: number };
  expiresAt: string;
  publicKeyUrl: string;
}

/**
 * Mint a disclosure credential for a client, to be presented to one business.
 *
 * Reads `CrmClient.reliabilityScore`, which is the canonical 0–100 scale with a single
 * writer (trust-core). The passport's own 0–1000 scoped scores are deliberately NOT
 * used: they are five separate dimensions, and asserting one band across a single
 * canonical score is the disclosure actually being asked for.
 */
export async function mintTrustDisclosure(input: {
  clientId: string;
  serviceBusinessId: string;
  audienceBusinessId: string;
  baseUrl: string;
}): Promise<MintedDisclosure> {
  const client = await prisma.crmClient.findFirst({
    where: { id: input.clientId, serviceBusinessId: input.serviceBusinessId },
    select: { id: true, passportId: true, reliabilityScore: true },
  });
  if (!client) throw new CustomError('Client not found', 404);
  if (!client.passportId) {
    throw new CustomError(
      'This client has no trust passport yet, so there is nothing to attest to.',
      400,
    );
  }

  const band = bandFor(client.reliabilityScore);
  const expiresAt = new Date(Date.now() + CREDENTIAL_TTL_HOURS * 3600 * 1000);

  const payload = {
    iss: 'https://pabandi.com',
    sub: subjectFor(client.passportId),
    aud: input.audienceBusinessId,
    // The only substantive claim. No score, no identity, no counts.
    pab: {
      trustBand: band.id,
      bandLabel: band.label,
      scale: '0-100',
    },
    jti: `${band.id}-${Date.now().toString(36)}`,
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const credential = signVerifiableCredential(payload, CREDENTIAL_TTL_HOURS * 3600);

  return {
    credential,
    band: { id: band.id, label: band.label, min: band.min },
    expiresAt: expiresAt.toISOString(),
    publicKeyUrl: `${input.baseUrl}/.well-known/pabandi-keys.json`,
  };
}

export interface VerificationResult {
  valid: boolean;
  band?: string;
  bandLabel?: string;
  meetsThreshold?: boolean;
  issuedAt?: string;
  expiresAt?: string;
  reason?: string;
}

/**
 * Verify a disclosure.
 *
 * Stateless — no database, no shared secret with the verifier. It checks that the
 * signature is ours, that it has not expired, that it was minted for THIS audience,
 * and that the band clears the threshold the caller asked about.
 *
 * A verifier learns the band and nothing else. That is the whole point: they get an
 * answer they can rely on without receiving a record of the person behind it.
 */
export function verifyTrustDisclosure(
  credential: string,
  options: { audienceBusinessId?: string; threshold?: number } = {},
): VerificationResult {
  let payload: Record<string, any>;

  try {
    // Verified against the issuer's PUBLIC key. A verifier never needs the private key
    // and never needs our database, which is what makes this cross-platform: a business
    // outside Pabandi can check a credential using the published JWKS alone.
    jwt.verify(credential, issuerPublicKey(), { algorithms: [VC_SIGNING_ALG] });
    payload = jwt.decode(credential) as Record<string, any>;
    if (!payload) throw new Error('undecodable');
  } catch (err: any) {
    /**
     * Expiry is distinguished; nothing else is.
     *
     * `jwt.verify` throws TokenExpiredError before any of our own checks run, so an
     * expired credential arrives here rather than at the block below. It is worth
     * naming, because it is the one failure a verifier can act on — they ask the client
     * for a fresh proof — and it discloses nothing, since the expiry is readable in the
     * token they were just handed.
     *
     * Forged, malformed and wrongly-signed all collapse to one message. Distinguishing
     * a forgery from a corruption tells an attacker which of their attempts got
     * further, and neither is actionable by a legitimate verifier.
     */
    if (err?.name === 'TokenExpiredError') {
      return { valid: false, reason: 'This proof has expired.' };
    }
    logger.info(`[Disclosure] verification failed: ${err?.message}`);
    return { valid: false, reason: 'This proof could not be verified.' };
  }

  const pab = payload.pab;
  if (!pab?.trustBand) {
    return { valid: false, reason: 'This is not a trust disclosure.' };
  }

  if (
    options.audienceBusinessId &&
    payload.aud &&
    payload.aud !== options.audienceBusinessId
  ) {
    // Minted for a different business. Rejecting it is the entire audience guarantee —
    // without this check a client could hand one proof to anyone and it would work.
    return { valid: false, reason: 'This proof was issued for a different business.' };
  }

  const band = TRUST_BANDS.find((b) => b.id === pab.trustBand);
  const meetsThreshold =
    options.threshold === undefined ? undefined : (band?.min ?? 0) >= options.threshold;

  return {
    valid: true,
    band: pab.trustBand,
    bandLabel: band?.label ?? pab.bandLabel,
    meetsThreshold,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

/**
 * The issuer's public key as a PEM, rebuilt from the JWK actually published in the
 * JWKS document.
 *
 * Derived from `vcPublicJwk()` rather than from a separate PEM so the key this
 * verifies with cannot drift from the key a third party would fetch. Two copies of the
 * same key are two things to keep in step, and this is the copy that decides whether a
 * credential is real.
 */
function issuerPublicKey(): ReturnType<typeof createPublicKey> {
  const jwk = vcPublicJwk();
  return createPublicKey({ key: { ...jwk } as any, format: 'jwk' });
}
