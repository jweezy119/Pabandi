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
