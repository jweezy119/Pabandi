import crypto from 'crypto';
import { CustomError } from '../middleware/errorHandler';

/**
 * Payment-rail webhook authentication.
 *
 * A payment webhook is a server-to-server assertion from the payment partner
 * that money arrived. It is not a user request, and it must not be authenticated
 * as one — but it must be authenticated as *the partner*, which is a different
 * and stronger thing than "has a valid session".
 *
 * Why this exists: the booking webhook originally sat behind the user
 * `authenticate` middleware and trusted a caller-supplied `railReference`. Any
 * logged-in user could therefore mark their own escrow FUNDED without paying,
 * then complete the appointment and have the retainer released. The escrow id
 * came back in the booking response, so nothing was secret. The failure was not
 * "missing auth" — it was trusting the wrong principal, which is worse, because
 * the auth header made the endpoint look handled.
 *
 * Four properties, all of which a naive implementation gets wrong:
 *
 *   1. Signature over the RAW body. Re-serialising the parsed JSON to recompute
 *      a hash is a classic bypass — key order and whitespace change the digest,
 *      so an attacker can supply a payload that verifies differently than it
 *      parses. `index.ts` already stashes the raw buffer via express.json's
 *      `verify` hook.
 *
 *   2. Timestamp inside the signed material, with a tolerance window, so a
 *      captured webhook cannot be replayed tomorrow to mark a fresh escrow paid.
 *
 *   3. Constant-time comparison. `===` on a MAC leaks its length and prefix by
 *      timing, which is enough to forge one byte at a time.
 *
 *   4. Amount and currency echoed by the partner are compared against what we
 *      expected. A signature proves the partner sent it; it does not prove the
 *      partner sent the *right* one. Without this, a valid webhook for a PKR 50
 *      payment could be replayed against a PKR 50,000 escrow.
 */

/** Header names the partner signs with. */
export const RAIL_SIGNATURE_HEADER = 'x-pabandi-rail-signature';
export const RAIL_TIMESTAMP_HEADER = 'x-pabandi-rail-timestamp';

/** Reject anything older than this. Payment confirmations are not delayed. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface RailWebhookClaims {
  /** Our escrow id. */
  escrowId: string;
  /** The partner's own transaction reference. */
  railReference: string;
  /** Amount the partner says arrived. Must equal the escrow's gross. */
  amount: number;
  currency: string;
  rail: string;
}

export function railWebhookSecret(): string {
  const secret = process.env.RAIL_WEBHOOK_SECRET;

  // Fail closed. A missing secret must not degrade into "accept everything",
  // which is precisely how the previous version shipped.
  if (!secret || secret.length < 32) {
    throw new CustomError(
      'Rail webhook verification is not configured. Set RAIL_WEBHOOK_SECRET to a ' +
        'random value of at least 32 characters shared with the payment partner.',
      503
    );
  }
  return secret;
}

function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Timing-safe MAC comparison.
 *
 * `crypto.timingSafeEqual` throws if the buffers differ in length, so the length
 * check is folded in here rather than leaked as an early return.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the failure path is not measurably faster.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * The exact bytes the partner signs: `<timestamp>.<rawBody>`.
 *
 * The timestamp is inside the signed material so an attacker cannot slide a
 * fresh timestamp onto a stale body.
 */
export function buildSignaturePayload(rawBody: string, timestamp: string): string {
  return `${timestamp}.${rawBody}`;
}

/**
 * Verify a rail webhook. Returns the claims only if the caller is genuinely the
 * partner and the call is fresh; otherwise throws.
 */
export function verifyRailWebhook(input: {
  rawBody: string;
  signature: string | undefined;
  timestamp: string | undefined;
  expectedEscrowId: string;
}): RailWebhookClaims {
  const { rawBody, signature, timestamp, expectedEscrowId } = input;

  if (!signature || !timestamp) {
    throw new CustomError('Missing rail webhook signature', 401);
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    throw new CustomError('Malformed rail webhook timestamp', 401);
  }

  const skew = Math.abs(Date.now() - ts);
  if (skew > MAX_CLOCK_SKEW_MS) {
    throw new CustomError(
      `Rail webhook timestamp is ${Math.round(skew / 1000)}s out of tolerance ` +
        `(max ${MAX_CLOCK_SKEW_MS / 1000}s)`,
      401
    );
  }

  const expected = hmacHex(
    railWebhookSecret(),
    buildSignaturePayload(rawBody, timestamp!)
  );

  if (!safeCompare(expected, signature)) {
    // Deliberately does not distinguish "bad signature" from "unknown escrow"
    // in the message, so this endpoint cannot be used as a MAC oracle.
    throw new CustomError('Invalid rail webhook signature', 401);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new CustomError('Rail webhook body is not valid JSON', 400);
  }

  // Now that the body is known authentic, trust its contents — but bind them to
  // what we asked about, so a valid webhook for one escrow cannot be applied to
  // another.
  const claims: RailWebhookClaims = {
    escrowId: String(parsed.escrowId ?? ''),
    railReference: String(parsed.railReference ?? ''),
    amount: Number(parsed.amount ?? 0),
    currency: String(parsed.currency ?? ''),
    rail: String(parsed.rail ?? ''),
  };

  if (claims.escrowId !== expectedEscrowId) {
    throw new CustomError('Rail webhook escrowId does not match the request', 400);
  }
  if (!claims.railReference) {
    throw new CustomError('Rail webhook is missing railReference', 400);
  }
  if (!Number.isFinite(claims.amount) || claims.amount <= 0) {
    throw new CustomError('Rail webhook is missing a valid amount', 400);
  }

  return claims;
}

/**
 * Check the partner's stated amount against what we expected to receive.
 *
 * Separate from signature verification on purpose: a valid signature only proves
 * the partner sent the message, not that the message is about this payment.
 */
export function assertAmountMatches(
  claims: RailWebhookClaims,
  expected: { grossAmount: number; currency: string }
): void {
  if (claims.currency.toUpperCase() !== expected.currency.toUpperCase()) {
    throw new CustomError(
      `Rail webhook currency ${claims.currency} does not match escrow currency ${expected.currency}`,
      400
    );
  }
  // Minor float tolerance: money arrives as a decimal string over the wire.
  if (Math.abs(claims.amount - expected.grossAmount) > 0.01) {
    throw new CustomError(
      `Rail webhook amount ${claims.amount} does not match the expected escrow amount ` +
        `${expected.grossAmount} ${expected.currency}`,
      400
    );
  }
}

/**
 * Helper for the partner-side (and for tests): produce the headers the partner
 * must send. Never called from a request handler.
 */
export function signRailWebhook(
  body: string,
  secret: string,
  timestamp = String(Date.now())
): Record<string, string> {
  return {
    [RAIL_TIMESTAMP_HEADER]: timestamp,
    [RAIL_SIGNATURE_HEADER]: hmacHex(secret, buildSignaturePayload(body, timestamp)),
  };
}
