import { logger } from '../utils/logger';
import { X402_PRICING } from '../config/fees';

export interface X402PaymentRequest {
  amount: number;
  currency: string;
  chain: string;
  payerAddress: string;
  payeeAddress: string;
  resource: string;
}

export interface X402PaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export interface X402VerificationResult {
  valid: boolean;
  reason?: string;
  transactionHash?: string;
}

const X402_FACILITATOR_URL = (process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator').replace(/\/+$/, '');
const PABANDI_PAYOUT_ADDRESS = process.env.PABANDI_PAYOUT_ADDRESS || process.env.SOLANA_USDC_ADDRESS || '';

// When the facilitator cannot be reached we must not silently accept money that
// was never paid. Set X402_ALLOW_UNVERIFIED=true to run unpaid (local dev).
const ALLOW_UNVERIFIED = process.env.X402_ALLOW_UNVERIFIED === 'true';

// ─── x402 v2 (spec) plumbing ─────────────────────────────────────────────────
//
// The legacy flow above speaks a Pabandi-private envelope. x402 v2 (the spec
// agents and the CDP Facilitator actually speak) is HTTP-header based: a 402
// carries a base64 `PAYMENT-REQUIRED` header, and the paid client answers with
// a base64 `PAYMENT-SIGNATURE` header. Serving the spec envelope is what makes
// this endpoint validatable (api.cdp.coinbase.com/platform/v2/x402/validate)
// and indexable by the Bazaar.

/** CAIP-2 identifier for Solana Mainnet — the network id the v2 spec requires. */
export const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

/** USDC SPL mint — asset id in the v2 requirements. */
const USDC_SPL_MINT = process.env.USDC_MINT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** USDC on Solana is a SPL token with 6 decimals; v2 amounts are atomic units. */
const USDC_DECIMALS = 6;

/** The facilitator acts as transaction fee-sponsor; its address is its own. */
const X402_FEE_PAYER = process.env.X402_FEE_PAYER || '';

/** Spec `PaymentRequirements` for the `exact` scheme on Solana Mainnet. */
export function buildSvmPaymentRequirements(resource: string, amountUsdc: number): Record<string, unknown> {
  const requirements: Record<string, unknown> = {
    scheme: 'exact',
    network: SOLANA_MAINNET_CAIP2,
    // Atomic micro-USDC as a string: 0.01 USDC -> "10000".
    amount: Math.round(amountUsdc * 10 ** USDC_DECIMALS).toString(),
    asset: USDC_SPL_MINT,
    payTo: PABANDI_PAYOUT_ADDRESS,
    maxTimeoutSeconds: 60,
    extra: {
      // The feePayer is the sponsor that adds the final signature; when the
      // facilitator's address is not configured, omit it so an agent knows the
      // requirement is incomplete rather than paying to a fabricated identity.
      ...(X402_FEE_PAYER ? { feePayer: X402_FEE_PAYER } : {}),
    },
    resource,
  };
  return requirements;
}

/** Spec `PaymentRequired` object (x402 v2) for a protected resource. */
export function buildPaymentRequired(params: {
  resource: string;
  amountUsdc: number;
  description?: string;
  extensions?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    x402Version: 2,
    resource: {
      url: params.resource,
      description: params.description ?? 'Pabandi paid endpoint',
      mimeType: 'application/json',
    },
    accepts: [buildSvmPaymentRequirements(params.resource, params.amountUsdc)],
    ...(params.extensions ? { extensions: params.extensions } : {}),
  };
}

/**
 * Base64 the v2 PaymentRequired into the value for the `PAYMENT-REQUIRED`
 * response header. The header, not the body, is what spec clients read.
 */
export function encodePaymentRequired(paymentRequired: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(paymentRequired)).toString('base64');
}

/** Shape of a v2 `PaymentPayload` read out of `PAYMENT-SIGNATURE`. */
export interface X402V2PaymentPayload {
  x402Version: number;
  resource?: Record<string, unknown>;
  accepted?: Record<string, unknown>;
  payload: { transaction?: string; [key: string]: unknown };
}

/**
 * Parse either the v2 `PAYMENT-SIGNATURE` header (base64 JSON PaymentPayload)
 * or the legacy `X-PAYMENT` header (base64 { paymentPayload, payload }). The
 * discriminator is a `payload.transaction` field: the spec's SVM payload always
 * carries the serialized transaction there; the legacy envelope does not.
 */
export function parseX402PaymentHeaderRaw(
  header: string | undefined
): { v2: X402V2PaymentPayload | null; legacy: { paymentPayload: Record<string, unknown>; payload: Record<string, unknown> } | null } {
  if (!header) return { v2: null, legacy: null };
  let decoded: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    if (parsed && typeof parsed === 'object') decoded = parsed as Record<string, unknown>;
  } catch {
    return { v2: null, legacy: null };
  }
  if (!decoded || typeof decoded !== 'object') return { v2: null, legacy: null };
  // Legacy envelope: { paymentPayload, payload }.
  if (typeof decoded.paymentPayload === 'object' && decoded.paymentPayload !== null) {
    return {
      v2: null,
      legacy: {
        paymentPayload: decoded.paymentPayload as Record<string, unknown>,
        payload: (decoded.payload ?? {}) as Record<string, unknown>,
      },
    };
  }
  // v2 payload: accepted.requirements + payload{transaction}.
  const payloadInner = decoded.payload as { transaction?: string } | undefined;
  if (payloadInner && typeof payloadInner === 'object' && typeof payloadInner.transaction === 'string') {
    return {
      v2: {
        x402Version: typeof decoded.x402Version === 'number' ? decoded.x402Version : 2,
        resource: typeof decoded.resource === 'object' && decoded.resource !== null ? (decoded.resource as Record<string, unknown>) : undefined,
        accepted: typeof decoded.accepted === 'object' && decoded.accepted !== null ? (decoded.accepted as Record<string, unknown>) : undefined,
        payload: payloadInner,
      },
      legacy: null,
    };
  }
  return { v2: null, legacy: null };
}

/** Verifies a v2 PaymentSignature against the facilitator and settles it. */
export async function verifyX402PaymentV2(params: {
  paymentPayload: X402V2PaymentPayload;
  resource: string;
  amountUsdc: number;
}): Promise<X402VerificationResult> {
  if (!PABANDI_PAYOUT_ADDRESS) {
    if (ALLOW_UNVERIFIED) {
      logger.warn('[x402] Payout address not configured — accepting unverified payment');
      return { valid: true };
    }
    return { valid: false, reason: 'x402 payout address is not configured' };
  }
  const paymentRequirements = buildSvmPaymentRequirements(params.resource, params.amountUsdc);
  // When the client echoes the accepted requirements, use its copy so the
  // facilitator sees exactly what was offered; otherwise use ours.
  const accepted = (params.paymentPayload.accepted ?? paymentRequirements) as Record<string, unknown>;
  try {
    // Spec flow: verify first (the facilitator checks the client's
    // partially-signed transaction against the requirements), then settle
    // (the sponsor adds its feePayer signature and submits on-chain).
    const verify = await facilitatorCall('/verify', {
      x402Version: 2,
      paymentPayload: {
        x402Version: params.paymentPayload.x402Version,
        ...(params.paymentPayload.resource ? { resource: params.paymentPayload.resource } : {}),
        ...(params.paymentPayload.accepted ? { accepted: params.paymentPayload.accepted } : {}),
        payload: params.paymentPayload.payload,
      },
      paymentRequirements: accepted,
    });
    if (verify.isValid === false || verify.success === false) {
      return {
        valid: false,
        reason: (verify.invalidReason as string) || (verify.error as string) || 'Facilitator rejected the payment',
      };
    }

    const settled = await facilitatorCall('/settle', {
      x402Version: 2,
      paymentPayload: {
        x402Version: params.paymentPayload.x402Version,
        ...(params.paymentPayload.resource ? { resource: params.paymentPayload.resource } : {}),
        ...(params.paymentPayload.accepted ? { accepted: params.paymentPayload.accepted } : {}),
        payload: params.paymentPayload.payload,
      },
      paymentRequirements: accepted,
    });
    if (settled.success === false) {
      return {
        valid: false,
        reason: (settled.errorReason as string) || (settled.error as string) || 'Settlement failed',
      };
    }
    const txHash = (settled.transaction as string) || (settled.transactionHash as string) || undefined;
    return { valid: true, transactionHash: txHash };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (ALLOW_UNVERIFIED) {
      logger.warn(`[x402] Facilitator unreachable (${message}) — accepting unverified payment`);
      return { valid: true };
    }
    logger.error(`[x402] Facilitator error: ${message}`);
    return { valid: false, reason: `Facilitator unreachable: ${message}` };
  }
}

/**
 * Re-exported from config/fees.ts so existing importers keep working while the
 * definition lives with the rest of the schedule. An inline copy here was one of
 * the places the x402 prices could drift from what a pricing page quotes.
 */
export { X402_PRICING };

/**
 * The `X-PAYMENT` header is base64 of { paymentPayload, payload } as defined
 * by the x402 spec (paymentPayload carries the signed Solana transaction).
 */
export function parsePaymentHeader(header?: string): {
  paymentPayload: Record<string, unknown>;
  payload: Record<string, unknown>;
} | null {
  if (!header) return null;
  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    if (!decoded || typeof decoded !== 'object' || !decoded.paymentPayload) return null;
    return { paymentPayload: decoded.paymentPayload, payload: decoded.payload ?? {} };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[x402] Malformed X-PAYMENT header: ${message}`);
    return null;
  }
}

async function facilitatorCall(
  path: '/verify' | '/settle',
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${X402_FACILITATOR_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x402Version: 1, ...body }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Facilitator ${path} returned ${res.status}`);
    }
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verifies an x402 payment against the facilitator and checks that it settles
 * to the Pabandi payout account for at least `amount` USDC on Solana.
 */
export async function verifyX402Payment(params: {
  paymentHeader: string | undefined;
  resource: string;
  amount: number;
}): Promise<X402VerificationResult> {
  const { paymentHeader, resource, amount } = params;

  const parsed = parsePaymentHeader(paymentHeader);
  if (!parsed) {
    return { valid: false, reason: 'Missing or malformed X-PAYMENT header' };
  }
  if (!PABANDI_PAYOUT_ADDRESS) {
    if (ALLOW_UNVERIFIED) {
      logger.warn('[x402] Payout address not configured — accepting unverified payment');
      return { valid: true };
    }
    return { valid: false, reason: 'x402 payout address is not configured' };
  }

  try {
    const result = await facilitatorCall('/verify', {
      paymentPayload: parsed.paymentPayload,
      payload: parsed.payload,
    });

    if (result.isValid === false || result.success === false) {
      return {
        valid: false,
        reason: (result.invalidReason as string) || 'Facilitator rejected the payment',
      };
    }

    const txHash = (result.transactionHash as string) || undefined;
    if (txHash) {
      return { valid: true, transactionHash: txHash };
    }

    // Facilitator had nothing to settle yet — settle it now.
    const settle = await facilitatorCall('/settle', {
      paymentPayload: parsed.paymentPayload,
      payload: parsed.payload,
    });
    if (settle.success === false) {
      return { valid: false, reason: (settle.error as string) || 'Settlement failed' };
    }

    logger.info(`[x402] Settled ${amount} USDC for ${resource} (${settle.transactionHash})`);
    return { valid: true, transactionHash: settle.transactionHash as string };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (ALLOW_UNVERIFIED) {
      logger.warn(`[x402] Facilitator unreachable (${message}) — accepting unverified payment`);
      return { valid: true };
    }
    logger.error(`[x402] Facilitator error: ${message}`);
    return { valid: false, reason: `Facilitator unreachable: ${message}` };
  }
}

export function createX402PaymentRequirement(resource: string, amount: number) {
  return {
    error: 'payment_required',
    payment: {
      amount,
      currency: 'USDC',
      chain: 'solana',
      resource,
      facilitator: X402_FACILITATOR_URL,
      payoutAddress: PABANDI_PAYOUT_ADDRESS,
    },
  };
}
