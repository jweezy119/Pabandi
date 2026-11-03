/**
 * mcpMeter.service.ts — x402 per-call MCP metering with tier-gated quota.
 *
 * Every MCP tool call is metered against a per-API-key prepaid USDC balance.
 * A call deducts its price (X402_PRICING, default MCP_TOOL_CALL = 0.001 USDC)
 * from the balance. When the balance cannot cover a call, the caller receives
 * a 402 with x402 payment requirements so they can top up before calling again.
 *
 * Tier-gated quota (new):
 *   - Free tier: 0 included calls — every call is metered per-call.
 *   - Paid subscribers (starter / pro / business): N calls/month included.
 *     Within quota, calls are charged 0. Once the monthly quota is exhausted,
 *     subsequent calls fall back to per-call metering from the prepaid balance.
 *   - Quota resets on the first call of each calendar month.
 *
 * Public tools (verify_passport / discover / get_ledger) are price 0 and are
 * never metered — they are the on-ramp, not a revenue surface.
 *
 * Usage is recorded in McpMeter (sliding 60s windows) and the balance lives in
 * McpPrepaidBalance. Monthly quota usage lives on ApiClient
 * (mcpCallsThisMonth / mcpQuotaResetsAt).
 */

import { z } from 'zod';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { X402_PRICING, MCP_QUOTA_BY_TIER } from '../config/fees';
import { tierDefinition, SUBSCRIPTION_TIERS } from '../config/subscriptions';
import {
  verifyX402Payment,
  buildPaymentRequired,
  encodePaymentRequired,
} from '../services/x402.service';
import { hashApiKey } from '../middleware/apiKey.middleware';

/** Default price per MCP tool call, USDC. */
const MCP_TOOL_CALL_USDC = Number(X402_PRICING.MCP_TOOL_CALL ?? 0.001);

/** Metering window: 60 seconds. */
const METER_WINDOW_MS = 60 * 1000;

/** Tools that are free to call (no x402, no metering). */
const FREE_TOOLS = new Set([
  'pabandi_verify_passport',
  'pabandi_discover',
  'pabandi_get_ledger',
]);

/** Paid tiers that receive a monthly MCP quota. */
const PAID_TIERS_WITH_QUOTA = new Set(['starter', 'pro', 'business']);

/**
 * Resolve the caller's API key from the request.
 *
 * Checks x-api-key first, then Authorization: Bearer <key>. Returns the raw
 * key string (not the hash) so callers can hash it themselves.
 */
export function resolveApiKey(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const headers = req.headers;
  let key: string | undefined;

  const raw = headers['x-api-key'];
  if (typeof raw === 'string') key = raw;
  else if (Array.isArray(raw) && raw.length) key = raw[0];

  if (!key) {
    const auth = headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const candidate = auth.slice(7).trim();
      // Bearer JWTs contain two dots; API keys issued by Pabandi do not. If it
      // looks like a JWT, skip it — the JWT path is handled by optionalAuthenticate
      // and sets req.user instead.
      if (candidate && candidate.split('.').length !== 3) key = candidate;
    }
  }

  return key ?? null;
}

/** Hash an API key for storage/lookup. */
export function hashKey(key: string): string {
  return hashApiKey(key);
}

/** Price for a tool, USDC. Public tools are 0. */
export function toolPriceUsdc(toolName: string): number {
  if (FREE_TOOLS.has(toolName)) return 0;
  return MCP_TOOL_CALL_USDC;
}

/** Included MCP calls per month for a subscription tier (0 = none). */
export function tierMonthlyQuota(tier: string | undefined): number {
  if (!tier || !PAID_TIERS_WITH_QUOTA.has(tier)) return 0;
  return Number(MCP_QUOTA_BY_TIER[tier] ?? 0);
}

export interface MeterResult {
  ok: boolean;
  toolName: string;
  /** List price for the tool (USDC). 0 if covered by quota or a free tool. */
  priceUsdc: number;
  /** True when this call was covered by the monthly quota (charged 0). */
  coveredByQuota: boolean;
  balanceBeforeUsdc: number;
  balanceAfterUsdc: number;
  callsInWindow: number;
  /** Remaining calls in the monthly quota, if the caller is on a paid tier. */
  quotaRemaining?: number;
}

/**
 * Resolve the caller's subscription tier from their API key.
 *
 * apiKeyHash → apiClient → business → merchantSubscription → tier.
 * Returns 'free' when there is no active paid subscription.
 */
export async function resolveSubscriptionTier(apiKeyHash: string): Promise<string> {
  const client = await prisma.apiClient.findUnique({
    where: { apiKeyHash },
    select: { businessId: true, tier: true },
  });
  if (!client || !client.businessId) return 'free';

  const sub = await prisma.merchantSubscription.findUnique({
    where: { businessId: client.businessId },
    select: { tier: true, status: true },
  });
  if (!sub || sub.status !== 'active') return 'free';
  return sub.tier;
}

/**
 * Meter and charge a single tool call.
 *
 * Order of precedence:
 *   1. Free tools (price 0) — never blocked, never metered against balance.
 *   2. Monthly quota (paid subscribers) — charged 0 while quota remains.
 *   3. Prepaid USDC balance — charged MCP_TOOL_CALL per call.
 *
 * Throws { x402: true, requirements } when balance cannot cover a call and no
 * valid payment proof is supplied — the MCP handler converts this to HTTP 402.
 */
export async function meterCall(
  apiKeyHash: string,
  toolName: string,
  reqForPayment?: { headers: Record<string, string | string[] | undefined> },
): Promise<MeterResult> {
  const price = toolPriceUsdc(toolName);
  if (price <= 0) {
    // Free tool: record zero-cost usage but never block.
    await recordUsage(apiKeyHash, toolName, 0);
    return { ok: true, toolName, priceUsdc: 0, coveredByQuota: false, balanceBeforeUsdc: 0, balanceAfterUsdc: 0, callsInWindow: 0 };
  }

  // ── Tier-gated monthly quota ────────────────────────────────────────────
  const tier = await resolveSubscriptionTier(apiKeyHash);
  const quota = tierMonthlyQuota(tier);

  if (quota > 0) {
    const quotaResult = await consumeMonthlyQuota(apiKeyHash, tier, quota);
    if (quotaResult.consumed) {
      // Covered by subscription quota — charge 0, record usage.
      await recordUsage(apiKeyHash, toolName, 0);
      logger.info(
        `[McpMeter] quota-covered ${toolName} key=${apiKeyHash.slice(0,8)}... tier=${tier} remaining=${quotaResult.remaining}`,
      );
      return {
        ok: true,
        toolName,
        priceUsdc: price,
        coveredByQuota: true,
        balanceBeforeUsdc: 0,
        balanceAfterUsdc: 0,
        callsInWindow: await windowCallCount(apiKeyHash, toolName),
        quotaRemaining: quotaResult.remaining,
      };
    }
    // Quota exhausted — fall through to prepaid balance metering.
  }

  // ── Prepaid balance metering ────────────────────────────────────────────
  let balance = await prisma.mcpPrepaidBalance.findUnique({ where: { apiKeyHash } });
  if (!balance) {
    balance = await prisma.mcpPrepaidBalance.create({
      data: { apiKeyHash, balanceUsdc: 0 },
    });
  }
  const balanceBefore = balance.balanceUsdc;

  // If the balance covers the call, deduct and proceed.
  if (balanceBefore >= price) {
    const updated = await prisma.mcpPrepaidBalance.update({
      where: { apiKeyHash },
      data: { balanceUsdc: balanceBefore - price },
    });
    await recordUsage(apiKeyHash, toolName, price);
    logger.info(
      `[McpMeter] charged ${price} USDC for ${toolName} key=${apiKeyHash.slice(0,8)}... tier=${tier} balance=${updated.balanceUsdc}`,
    );
    return {
      ok: true,
      toolName,
      priceUsdc: price,
      coveredByQuota: false,
      balanceBeforeUsdc: balanceBefore,
      balanceAfterUsdc: updated.balanceUsdc,
      callsInWindow: await windowCallCount(apiKeyHash, toolName),
      quotaRemaining: quota > 0 ? 0 : undefined,
    };
  }

  // Insufficient balance: require an x402 payment to top up before the call.
  const requirements = buildX402Requirements(toolName, price, balanceBefore);
  const paymentProof = extractPaymentProof(reqForPayment);
  if (paymentProof) {
    const topUp = await topUpBalance(apiKeyHash, paymentProof, price);
    if (topUp.ok) {
      const afterTopUp = await prisma.mcpPrepaidBalance.findUnique({
        where: { apiKeyHash },
      });
      const available = afterTopUp?.balanceUsdc ?? 0;
      if (available < price) {
        const req2 = buildX402Requirements(toolName, price, available);
        throw { x402: true, requirements: { ...req2, invalidReason: 'payment credited but still insufficient for call' } };
      }
      const deducted = await prisma.mcpPrepaidBalance.update({
        where: { apiKeyHash },
        data: { balanceUsdc: available - price },
      });
      await recordUsage(apiKeyHash, toolName, price);
      logger.info(
        `[McpMeter] topped up and charged ${price} USDC for ${toolName} key=${apiKeyHash.slice(0,8)}... balance=${deducted.balanceUsdc}`,
      );
      return {
        ok: true,
        toolName,
        priceUsdc: price,
        coveredByQuota: false,
        balanceBeforeUsdc: available,
        balanceAfterUsdc: deducted.balanceUsdc,
        callsInWindow: await windowCallCount(apiKeyHash, toolName),
        quotaRemaining: quota > 0 ? 0 : undefined,
      };
    }
    throw new X402PaymentRequiredError({ ...requirements, invalidReason: topUp.reason ?? 'payment not verified' });
  }

  throw new X402PaymentRequiredError(requirements);
}

/**
 * Thrown when an MCP caller's prepaid balance is insufficient to cover a
 * tool call. Carries the x402 payment requirements the client must satisfy
 * before retrying. The MCP dispatch layer converts this to an HTTP 402 with
 * a `Payment-Required` header so spec-compliant clients can discover how
 * much to pay and where to send it.
 */
export class X402PaymentRequiredError extends Error {
  readonly requirements: Record<string, unknown>;
  constructor(requirements: Record<string, unknown>) {
    super(JSON.stringify(requirements));
    this.name = 'X402PaymentRequiredError';
    this.requirements = requirements;
  }
}

/**
 * Credit a prepaid balance from a verified x402 payment.
 */
export async function topUpBalance(
  apiKeyHash: string,
  paymentHeader: string,
  minUsdc: number,
): Promise<{ ok: boolean; reason?: string; creditedUsdc?: number; balanceUsdc?: number }> {
  const result = await verifyX402Payment({
    paymentHeader,
    resource: 'mcp:topup',
    amount: minUsdc,
  });
  if (!result.valid) {
    return { ok: false, reason: result.reason ?? 'payment not verified' };
  }
  const credited = minUsdc;
  const before = (await prisma.mcpPrepaidBalance.findUnique({ where: { apiKeyHash } }))?.balanceUsdc ?? 0;
  const updated = await prisma.mcpPrepaidBalance.upsert({
    where: { apiKeyHash },
    create: { apiKeyHash, balanceUsdc: credited },
    update: { balanceUsdc: { increment: credited } },
  });
  logger.info(
    `[McpMeter] top-up ${credited} USDC key=${apiKeyHash.slice(0,8)}... balance ${before} -> ${updated.balanceUsdc}`,
  );
  return { ok: true, creditedUsdc: credited, balanceUsdc: updated.balanceUsdc };
}

/** Read the current prepaid balance for a key. */
export async function getBalance(apiKeyHash: string): Promise<number> {
  const row = await prisma.mcpPrepaidBalance.findUnique({ where: { apiKeyHash } });
  return row?.balanceUsdc ?? 0;
}

/** Read the current monthly quota state for a key. */
export async function getQuotaState(apiKeyHash: string): Promise<{ tier: string; quota: number; used: number; remaining: number; resetsAt: Date | null }> {
  const tier = await resolveSubscriptionTier(apiKeyHash);
  const quota = tierMonthlyQuota(tier);
  const client = await prisma.apiClient.findUnique({
    where: { apiKeyHash },
    select: { mcpCallsThisMonth: true, mcpQuotaResetsAt: true },
  });
  const used = client?.mcpCallsThisMonth ?? 0;
  return { tier, quota, used, remaining: Math.max(0, quota - used), resetsAt: client?.mcpQuotaResetsAt ?? null };
}

/* ── internals ─────────────────────────────────────────────────────────── */

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function consumeMonthlyQuota(
  apiKeyHash: string,
  tier: string,
  quota: number,
): Promise<{ consumed: boolean; remaining: number }> {
  const now = Date.now();
  const client = await prisma.apiClient.findUnique({
    where: { apiKeyHash },
    select: { mcpCallsThisMonth: true, mcpQuotaResetsAt: true },
  });
  const used = client?.mcpCallsThisMonth ?? 0;
  const resetsAt = client?.mcpQuotaResetsAt ? new Date(client.mcpQuotaResetsAt).getTime() : 0;

  // Reset quota at the start of a new month.
  let nextUsed = used;
  let nextResetsAt = resetsAt;
  if (!resetsAt || now >= resetsAt + MONTH_MS) {
    nextUsed = 0;
    nextResetsAt = now + MONTH_MS;
  }

  if (nextUsed >= quota) {
    return { consumed: false, remaining: 0 };
  }

  const updated = await prisma.apiClient.update({
    where: { apiKeyHash },
    data: {
      mcpCallsThisMonth: nextUsed + 1,
      mcpQuotaResetsAt: new Date(nextResetsAt),
    },
  });
  return { consumed: true, remaining: quota - (nextUsed + 1) };
}

async function recordUsage(apiKeyHash: string, toolName: string, chargedUsdc: number): Promise<void> {
  const windowStart = new Date(Date.now() - (Date.now() % METER_WINDOW_MS));
  await prisma.mcpMeter.upsert({
    where: { apiKeyHash_toolName_windowStart: { apiKeyHash, toolName, windowStart } },
    create: { apiKeyHash, toolName, windowStart, callsCount: 1, chargedUsdc },
    update: { callsCount: { increment: 1 }, chargedUsdc: { increment: chargedUsdc } },
  });
}

async function windowCallCount(apiKeyHash: string, toolName: string): Promise<number> {
  const windowStart = new Date(Date.now() - (Date.now() % METER_WINDOW_MS));
  const row = await prisma.mcpMeter.findUnique({
    where: { apiKeyHash_toolName_windowStart: { apiKeyHash, toolName, windowStart } },
    select: { callsCount: true },
  });
  return row?.callsCount ?? 0;
}

function extractPaymentProof(req?: { headers: Record<string, string | string[] | undefined> }): string | null {
  if (!req) return null;
  const headers = req.headers;
  const sig = headers['payment-signature'];
  if (typeof sig === 'string') return sig;
  if (Array.isArray(sig) && sig.length) return sig[0];
  const hdr = headers['x-payment'];
  if (typeof hdr === 'string') return hdr;
  if (Array.isArray(hdr) && hdr.length) return hdr[0];
  return null;
}

function buildX402Requirements(toolName: string, priceUsdc: number, balanceUsdc: number): Record<string, unknown> {
  return {
    x402: true,
    scheme: 'x402',
    price: `${priceUsdc} USDC`,
    network: 'solana',
    recipient: process.env.PABANDI_PAYOUT_ADDRESS || process.env.SOLANA_USDC_ADDRESS || 'PABANDI_USDC_WALLET',
    tool: toolName,
    resource: `mcp:${toolName}`,
    paymentMethods: ['solana-usdc', 'x402'],
    balanceUsdc,
    shortfallUsdc: Math.max(0, priceUsdc - balanceUsdc),
    hint: 'Include a valid x-payment or payment-signature header (x402 proof) to unlock this call, or pre-fund your MCP balance.',
  };
}

const meterCallSchema = z.object({
  apiKeyHash: z.string().min(1),
  toolName: z.string().min(1),
  priceUsdc: z.number().nonnegative(),
});

export { meterCallSchema };
