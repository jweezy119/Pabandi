import { PublicKey } from '@solana/web3.js';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';

export type WebacyRiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
export type WebacyCheckStatus = 'ok' | 'unconfigured' | 'unavailable';

export interface WebacyRiskIssue {
  tag?: string;
  severity?: string;
  description?: string;
  riskScore?: number;
}

export interface WebacyWalletRiskResult {
  provider: 'webacy';
  chain: 'sol';
  walletAddress: string;
  status: WebacyCheckStatus;
  overallRisk: number | null;
  riskBand: WebacyRiskBand;
  highSeverityCount: number;
  mediumSeverityCount: number;
  isSanctioned: boolean;
  isContract: boolean | null;
  issues: WebacyRiskIssue[];
  blocked: boolean;
  threshold: number;
  cached: boolean;
  checkedAt: string;
  reason?: string;
}

export class WebacyRiskBlockedError extends Error {
  public readonly risk: WebacyWalletRiskResult;

  constructor(message: string, risk: WebacyWalletRiskResult) {
    super(message);
    this.name = 'WebacyRiskBlockedError';
    this.risk = risk;
  }
}

interface WebacyConfig {
  apiKey: string;
  baseUrl: string;
  maxEscrowRisk: number;
  cacheTtlMs: number;
  timeoutMs: number;
  failClosed: boolean;
}

function getConfig(): WebacyConfig {
  const rawBase = (process.env.WEBACY_API_BASE_URL || 'https://api.webacy.com').replace(/\/+$/, '');
  // Webacy v2 gateway rejects `/api/` prefixes with 403 Missing Authentication Token.
  const baseUrl = rawBase.replace(/\/api(?:\/v\d+)?$/i, '');

  const parsedThreshold = Number(process.env.WEBACY_MAX_ESCROW_RISK ?? 75);
  const maxEscrowRisk = Number.isFinite(parsedThreshold)
    ? Math.min(100, Math.max(1, parsedThreshold))
    : 75;

  const parsedTtl = Number(process.env.WEBACY_CACHE_TTL_MS ?? 15 * 60 * 1000);
  const cacheTtlMs = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 15 * 60 * 1000;

  const parsedTimeout = Number(process.env.WEBACY_TIMEOUT_MS ?? 5000);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 5000;

  return {
    apiKey: (process.env.WEBACY_API_KEY || '').trim(),
    baseUrl,
    maxEscrowRisk,
    cacheTtlMs,
    timeoutMs,
    failClosed: String(process.env.WEBACY_FAIL_CLOSED || 'false').toLowerCase() === 'true',
  };
}

function validateSolanaAddress(walletAddress: string): string {
  const trimmed = String(walletAddress || '').trim();
  if (!trimmed) {
    throw new Error('walletAddress is required');
  }
  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    throw new Error(`Invalid Solana wallet address: ${trimmed}`);
  }
}

function classifyRiskBand(overallRisk: number | null, isSanctioned: boolean): WebacyRiskBand {
  if (isSanctioned) return 'CRITICAL';
  if (overallRisk === null || !Number.isFinite(overallRisk)) return 'UNKNOWN';
  if (overallRisk >= 75) return 'CRITICAL';
  if (overallRisk >= 50) return 'HIGH';
  if (overallRisk >= 25) return 'MEDIUM';
  return 'LOW';
}

function extractIssues(raw: any): WebacyRiskIssue[] {
  const rawIssues = Array.isArray(raw?.issues) ? raw.issues : [];
  const normalized: WebacyRiskIssue[] = [];

  for (const issue of rawIssues) {
    if (!issue || typeof issue !== 'object') continue;

    // Webacy returns either flat issue objects or grouped { score, tags: [{ key, name, severity, description }] }
    if (Array.isArray(issue.tags) && issue.tags.length > 0) {
      for (const tag of issue.tags) {
        normalized.push({
          tag: tag?.key || tag?.name || tag?.type || undefined,
          severity: tag?.severity !== undefined ? String(tag.severity) : undefined,
          description: tag?.description || tag?.name || undefined,
          riskScore: typeof issue.score === 'number' ? issue.score : undefined,
        });
      }
    } else {
      normalized.push({
        tag: issue.tag || issue.key || issue.name || issue.type || undefined,
        severity: issue.severity !== undefined ? String(issue.severity) : undefined,
        description: issue.description || issue.message || undefined,
        riskScore: typeof issue.score === 'number' ? issue.score : undefined,
      });
    }
  }

  return normalized;
}

function detectSanctioned(raw: any, issues: WebacyRiskIssue[]): boolean {
  if (raw?.isSanctioned === true || raw?.sanctioned === true || raw?.is_sanctioned === true) {
    return true;
  }
  return issues.some((issue) => {
    const haystack = `${issue.tag || ''} ${issue.description || ''}`.toLowerCase();
    return /\b(sanction|sanctioned|ofac|sdn)\b/.test(haystack);
  });
}

// LRU cache preserves Webacy's free tier (500 req/month) across repeated passport views and agent lookups.
const riskCache = new LRUCache<string, WebacyWalletRiskResult>({
  max: 2000,
  ttl: 15 * 60 * 1000,
});

// Deduplicate simultaneous in-flight checks for the same wallet.
const inFlight = new Map<string, Promise<WebacyWalletRiskResult>>();

async function fetchFromWebacy(
  normalizedWallet: string,
  config: WebacyConfig
): Promise<WebacyWalletRiskResult> {
  const checkedAt = new Date().toISOString();
  const url = `${config.baseUrl}/addresses/${encodeURIComponent(normalizedWallet)}?chain=sol`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 429) {
      logger.warn(`[WebacyRisk] Rate limited (429) while screening Solana wallet ${normalizedWallet}`);
      return {
        provider: 'webacy',
        chain: 'sol',
        walletAddress: normalizedWallet,
        status: 'unavailable',
        overallRisk: null,
        riskBand: 'UNKNOWN',
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        isSanctioned: false,
        isContract: null,
        issues: [],
        blocked: config.failClosed,
        threshold: config.maxEscrowRisk,
        cached: false,
        checkedAt,
        reason: 'Webacy API rate limit exceeded (429).',
      };
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      logger.warn(
        `[WebacyRisk] Non-OK response (${response.status}) for ${normalizedWallet}: ${bodyText.slice(0, 200)}`
      );
      return {
        provider: 'webacy',
        chain: 'sol',
        walletAddress: normalizedWallet,
        status: 'unavailable',
        overallRisk: null,
        riskBand: 'UNKNOWN',
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        isSanctioned: false,
        isContract: null,
        issues: [],
        blocked: config.failClosed,
        threshold: config.maxEscrowRisk,
        cached: false,
        checkedAt,
        reason: `Webacy API returned HTTP ${response.status}.`,
      };
    }

    const raw = (await response.json()) as Record<string, any>;
    const overallRisk =
      typeof raw?.overallRisk === 'number' && Number.isFinite(raw.overallRisk)
        ? Math.round(raw.overallRisk * 100) / 100
        : null;
    const issues = extractIssues(raw);
    const isSanctioned = detectSanctioned(raw, issues);
    const highSeverityCount = Number(raw?.high ?? 0) || 0;
    const mediumSeverityCount = Number(raw?.medium ?? 0) || 0;
    const isContract = typeof raw?.isContract === 'boolean' ? raw.isContract : null;
    const riskBand = classifyRiskBand(overallRisk, isSanctioned);
    const blocked = isSanctioned || (overallRisk !== null && overallRisk >= config.maxEscrowRisk);

    const reason = isSanctioned
      ? 'Wallet flagged on sanctions / OFAC list by Webacy Risk Intelligence.'
      : blocked
        ? `Wallet risk score ${overallRisk}/100 meets or exceeds escrow threshold (${config.maxEscrowRisk}).`
        : undefined;

    const result: WebacyWalletRiskResult = {
      provider: 'webacy',
      chain: 'sol',
      walletAddress: normalizedWallet,
      status: 'ok',
      overallRisk,
      riskBand,
      highSeverityCount,
      mediumSeverityCount,
      isSanctioned,
      isContract,
      issues,
      blocked,
      threshold: config.maxEscrowRisk,
      cached: false,
      checkedAt,
      ...(reason ? { reason } : {}),
    };

    riskCache.set(normalizedWallet, result, { ttl: config.cacheTtlMs });
    return result;
  } catch (err: any) {
    const timedOut = err?.name === 'AbortError';
    const reason = timedOut
      ? `Webacy API timed out after ${config.timeoutMs}ms.`
      : `Webacy API request failed: ${err?.message || 'network error'}.`;

    logger.warn(`[WebacyRisk] ${reason} (wallet=${normalizedWallet})`);
    return {
      provider: 'webacy',
      chain: 'sol',
      walletAddress: normalizedWallet,
      status: 'unavailable',
      overallRisk: null,
      riskBand: 'UNKNOWN',
      highSeverityCount: 0,
      mediumSeverityCount: 0,
      isSanctioned: false,
      isContract: null,
      issues: [],
      blocked: config.failClosed,
      threshold: config.maxEscrowRisk,
      cached: false,
      checkedAt,
      reason,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const webacyRiskService = {
  /**
   * Screen a Solana wallet address using Webacy Risk Intelligence.
   * Validates Base58 PublicKey locally before spending any API quota and caches results.
   */
  async screenSolanaWallet(
    walletAddress: string,
    options?: { bypassCache?: boolean }
  ): Promise<WebacyWalletRiskResult> {
    const normalizedWallet = validateSolanaAddress(walletAddress);
    const config = getConfig();

    if (!config.apiKey) {
      return {
        provider: 'webacy',
        chain: 'sol',
        walletAddress: normalizedWallet,
        status: 'unconfigured',
        overallRisk: null,
        riskBand: 'UNKNOWN',
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        isSanctioned: false,
        isContract: null,
        issues: [],
        blocked: false,
        threshold: config.maxEscrowRisk,
        cached: false,
        checkedAt: new Date().toISOString(),
        reason: 'WEBACY_API_KEY is not configured; on-chain risk screening skipped.',
      };
    }

    if (!options?.bypassCache) {
      const hit = riskCache.get(normalizedWallet);
      if (hit) {
        return { ...hit, cached: true };
      }
    }

    const existingPromise = inFlight.get(normalizedWallet);
    if (existingPromise && !options?.bypassCache) {
      const res = await existingPromise;
      return { ...res, cached: true };
    }

    const promise = fetchFromWebacy(normalizedWallet, config).finally(() => {
      inFlight.delete(normalizedWallet);
    });
    inFlight.set(normalizedWallet, promise);

    return promise;
  },

  /**
   * Pre-escrow oracle gate.
   * Hard-blocks confirmed high-risk (overallRisk >= WEBACY_MAX_ESCROW_RISK) or sanctioned wallets.
   * Respects WEBACY_FAIL_CLOSED on upstream outages/429 (defaults to fail-open with warning).
   */
  async assertSolanaWalletSafeForEscrow(walletAddress: string): Promise<WebacyWalletRiskResult> {
    const risk = await this.screenSolanaWallet(walletAddress);

    if (risk.blocked) {
      logger.warn(
        `[WebacyRisk] Blocking Solana escrow co-sign for ${risk.walletAddress}: ` +
          `score=${risk.overallRisk} band=${risk.riskBand} sanctioned=${risk.isSanctioned} status=${risk.status}`
      );
      throw new WebacyRiskBlockedError(
        `Escrow co-sign blocked by Webacy on-chain risk screening (${risk.riskBand}${
          risk.overallRisk !== null ? `, score ${risk.overallRisk}/100` : ''
        }): ${risk.reason || 'Wallet exceeds acceptable on-chain risk threshold.'}`,
        risk
      );
    }

    if (risk.status === 'unavailable') {
      logger.warn(
        `[WebacyRisk] Proceeding fail-open for ${risk.walletAddress} because Webacy API was unavailable: ${risk.reason}`
      );
    }

    return risk;
  },

  clearCache(): void {
    riskCache.clear();
    inFlight.clear();
  },
};
