import { PrivyClient } from '@privy-io/server-auth';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/errorHandler';
import {
  evaluatePrivyTrustBand,
  PrivyLinkedAccount,
  PrivyUserPayload,
  TrustBandEvaluation,
} from './privyTrustScoring';

/**
 * Pull-based Privy trust-band sync.
 *
 * Privy webhooks are an Enterprise-only feature, so this account can never
 * receive `user.*` / `mfa.*` events. Instead of waiting for events we pull the
 * user on demand: the client presents its Privy access token, we verify it,
 * re-read the raw user from Privy's API, score it with the same pure function
 * the webhook path used, and write the result through the same writer.
 *
 * Why the raw API and not `PrivyClient.getUserById`:
 * `getUserById` runs the response through `convertUserResponseToUser`, which
 * maps `linked_accounts` -> `linkedAccounts` but DROPS `mfa_methods` entirely.
 * `mfaMethods` feeds Band A's phishing-resistant requirement, so using the SDK
 * would silently cap MFA-only users at Band B. The raw payload carries both
 * `linked_accounts` and `mfa_methods`, and `PrivyUserPayload` accepts either
 * spelling, so the scorer is fed unmodified.
 */

/** Thrown for every expected failure so routes can map it to a status code. */
export class PrivySyncError extends CustomError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode);
  }
}

export interface TrustBandSyncResult {
  userId: string;
  privyUserId: string;
  band: TrustBandEvaluation['band'];
  score: number;
  reason: string;
  totalLinks: number;
  hasPhishingResistant: boolean;
  hasOAuth: boolean;
  verificationTier: string;
}

let cachedClient: { key: string; client: PrivyClient } | null = null;

/**
 * Singleton PrivyClient, or null when the app has no server credentials.
 *
 * Keyed on the credential pair so a rotated secret (or a test that swaps env
 * vars mid-run) picks up a fresh client instead of the stale cached one.
 */
export function getPrivyClient(): PrivyClient | null {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return null;

  const key = `${appId}:${appSecret}`;
  if (!cachedClient || cachedClient.key !== key) {
    cachedClient = { key, client: new PrivyClient(appId, appSecret) };
  }
  return cachedClient.client;
}

/** True when server-side Privy features are configured. */
export function isPrivyServerConfigured(): boolean {
  return Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

/**
 * Read the raw user object from Privy: `linked_accounts` + `mfa_methods`.
 * Throws `PrivySyncError` when Privy does not know the DID (404 from Privy).
 */
export async function fetchPrivyUserRaw(privyUserId: string): Promise<PrivyUserPayload> {
  const client = getPrivyClient();
  if (!client) {
    throw new PrivySyncError('Privy server credentials are not configured', 503);
  }

  let response: { data?: PrivyUserPayload };
  try {
    // `getUserById` issues exactly this request internally
    // (`userPath(id)` -> `/api/v1/users/{id}` on the SDK's own base URL) but
    // then runs the body through `convertUserResponseToUser`, which drops
    // `mfa_methods`. We want the untouched body, so we go through the same
    // HTTP client and skip the conversion. The cast is narrow on purpose: the
    // only member we touch is `get(path)`.
    const rawApi = (client as unknown as { api: { get(path: string): Promise<{ data?: PrivyUserPayload }> } }).api;
    response = await rawApi.get(`/api/v1/users/${privyUserId}`);
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    const detail =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      (err instanceof Error ? err.message : 'unknown error');
    logger.warn(`[PrivySync] Failed to read user ${privyUserId} from Privy: ${status} ${detail}`);
    throw new PrivySyncError(
      status === 404
        ? 'Privy does not recognise this account. Sign in with Privy again and retry.'
        : 'Could not read your identity from Privy. Please try again.',
      status === 404 ? 404 : 502
    );
  }

  const data = response?.data;
  if (!data?.id) {
    throw new PrivySyncError('Privy returned an empty user payload', 502);
  }
  return data;
}

/** Email address carried by a Privy linked account, if any. */
export function privyEmailFromAccounts(accounts: PrivyLinkedAccount[]): string | undefined {
  const emailAcc = accounts.find(
    (a) => (a.type === 'email' || a.type === 'google_oauth') && typeof a.address === 'string'
  );
  return (emailAcc?.address as string | undefined) || (emailAcc?.email as string | undefined);
}

/**
 * Map a Privy user onto a Pabandi user id, or null when there is no match.
 * Order: existing `privy` auth method -> email -> wallet address.
 */
export async function resolvePabandiUserForPrivy(
  privyUser: PrivyUserPayload
): Promise<string | null> {
  const authMethod = await prisma.userAuthMethod.findUnique({
    where: {
      provider_providerId: { provider: 'privy', providerId: privyUser.id },
    },
  });
  if (authMethod) return authMethod.userId;

  const accounts = privyUser.linkedAccounts || privyUser.linked_accounts || [];

  const email = privyEmailFromAccounts(accounts);
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return existing.id;
  }

  const walletAcc = accounts.find((a) => a.type === 'wallet' && typeof a.address === 'string');
  if (walletAcc) {
    const existing = await prisma.user.findUnique({
      where: { walletAddress: walletAcc.address as string },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  return null;
}

/**
 * The single writer for Privy-derived trust data. Shared by the webhook path
 * and the pull path so the two can never drift apart.
 *
 * Writes, atomically:
 *   User.trustScore / User.verificationTier
 *   UserAuthMethod.metadata (band, score, reason, links)
 *   TrustPassport.score / TrustPassport.riskBand (only if a passport exists)
 */
export async function applyTrustBandEvaluation({
  userId,
  privyUserId,
  evaluation,
  source,
}: {
  userId: string;
  privyUserId: string;
  evaluation: TrustBandEvaluation;
  source: string;
}): Promise<void> {
  const metadata = {
    trustBand: evaluation.band,
    trustScore: evaluation.score,
    reason: evaluation.reason,
    totalLinks: evaluation.totalLinks,
    lastEvent: source,
    updatedAt: new Date().toISOString(),
  };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        trustScore: evaluation.score,
        verificationTier: `BAND_${evaluation.band}`,
      },
    }),
    prisma.userAuthMethod.upsert({
      where: {
        provider_providerId: { provider: 'privy', providerId: privyUserId },
      },
      update: { metadata, lastUsedAt: new Date() },
      create: { userId, provider: 'privy', providerId: privyUserId, metadata },
    }),
  ]);

  await prisma.trustPassport
    .updateMany({
      where: { userId },
      data: { score: evaluation.score, riskBand: evaluation.band },
    })
    .catch((passportErr) => {
      logger.warn(`[PrivySync] Could not update TrustPassport for user ${userId}: ${passportErr}`);
    });

  logger.info(
    `[PrivySync] Recorded Trust Band ${evaluation.band} (score ${evaluation.score}) for Pabandi user ${userId} via ${source}.`
  );
}

/**
 * Verify a client-supplied Privy access token and pull the trust band for the
 * ALREADY-AUTHENTICATED Pabandi user.
 *
 * `accessToken` proves the caller controls the Privy identity; `userId` comes
 * from the Pabandi session JWT and is never taken from the client body. The
 * two are cross-checked before anything is written, so a valid token for an
 * identity belonging to someone else is rejected rather than re-linked.
 */
export async function syncPrivyIdentityForUser({
  userId,
  accessToken,
}: {
  userId: string;
  accessToken: string;
}): Promise<TrustBandSyncResult> {
  const client = getPrivyClient();
  if (!client) {
    throw new PrivySyncError('Privy server credentials are not configured', 503);
  }

  // 1. Verify the token against Privy's JWKS. Signature and expiry are checked
  //    here; nothing downstream trusts an unverified claim.
  let claims: { userId?: string };
  try {
    claims = await client.verifyAuthToken(accessToken);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'unknown error';
    logger.warn(`[PrivySync] Rejected unverifiable Privy token for user ${userId}: ${detail}`);
    throw new PrivySyncError('Your Privy session could not be verified', 401);
  }

  const privyUserId = claims?.userId;
  if (!privyUserId || !privyUserId.startsWith('did:privy:')) {
    throw new PrivySyncError('Privy token does not identify a user', 401);
  }

  // 2. The identity must not already belong to a different Pabandi account.
  const existingMethod = await prisma.userAuthMethod.findUnique({
    where: { provider_providerId: { provider: 'privy', providerId: privyUserId } },
  });
  if (existingMethod && existingMethod.userId !== userId) {
    logger.warn(
      `[PrivySync] User ${userId} tried to claim Privy identity ${privyUserId}, which belongs to user ${existingMethod.userId}.`
    );
    throw new PrivySyncError('That identity is already linked to a different Pabandi account', 409);
  }

  // 3. Pull the raw user (linked_accounts + mfa_methods) and score it.
  const rawUser = await fetchPrivyUserRaw(privyUserId);

  // 4. Cross-account guard: an email on this identity must not already be a
  //    different Pabandi account, otherwise linking here would attach one
  //    person's Privy identity to another person's Pabandi profile.
  const accounts = rawUser.linkedAccounts || rawUser.linked_accounts || [];
  const email = privyEmailFromAccounts(accounts);
  if (email) {
    const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (owner && owner.id !== userId) {
      logger.warn(
        `[PrivySync] User ${userId} tried to claim Privy identity ${privyUserId}, whose email ${email} belongs to user ${owner.id}.`
      );
      throw new PrivySyncError(
        "That identity's email address is already in use by another Pabandi account",
        409
      );
    }
  }

  const evaluation = evaluatePrivyTrustBand(rawUser);
  await applyTrustBandEvaluation({ userId, privyUserId, evaluation, source: 'pull-sync' });

  return {
    userId,
    privyUserId,
    band: evaluation.band,
    score: evaluation.score,
    reason: evaluation.reason,
    totalLinks: evaluation.totalLinks,
    hasPhishingResistant: evaluation.hasPhishingResistant,
    hasOAuth: evaluation.hasOAuth,
    verificationTier: `BAND_${evaluation.band}`,
  };
}
