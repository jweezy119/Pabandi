import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { verifyPrivyWebhookSignature } from '../utils/privyWebhookVerify';
import { evaluatePrivyTrustBand, PrivyUserPayload } from '../services/privyTrustScoring';
import {
  applyTrustBandEvaluation,
  PrivySyncError,
  resolvePabandiUserForPrivy,
  syncPrivyIdentityForUser,
} from '../services/privyTrustSync.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const SUPPORTED_EVENTS = new Set([
  'user.created',
  'user.linked_account',
  'user.unlinked_account',
  'user.authenticated',
  'mfa.enabled',
  'mfa.disabled',
]);

/**
 * POST /api/v1/privy/sync
 *
 * Pull-based trust-band scoring — the path this account actually uses.
 *
 * Privy webhooks are Enterprise-only, so no event will ever reach
 * POST /webhooks below. The client presents its Privy access token here, the
 * server verifies it against Privy's JWKS, re-reads the raw user, scores it and
 * writes the band through `applyTrustBandEvaluation` — the same writer the
 * webhook path uses.
 *
 * Requires BOTH:
 *   - `authenticate`  -> the Pabandi session JWT (who the score is written to)
 *   - a Privy access token in the body -> proof the caller owns the identity
 * The two are cross-checked; neither alone is enough to claim an identity.
 */
router.post('/sync', rateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  const body = (req.body ?? {}) as { privyAccessToken?: unknown };
  const accessToken = typeof body.privyAccessToken === 'string' ? body.privyAccessToken.trim() : '';

  if (!accessToken) {
    return res.status(400).json({ error: 'privyAccessToken is required' });
  }
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await syncPrivyIdentityForUser({
      userId: req.user.id,
      accessToken,
    });
    return res.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof PrivySyncError) {
      if (err.statusCode >= 500) {
        logger.error(`[PrivySync] Sync failed for user ${req.user.id}: ${err.message}`);
      } else {
        logger.warn(`[PrivySync] Sync rejected for user ${req.user.id}: ${err.message}`);
      }
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error(
      `[PrivySync] Unexpected failure for user ${req.user.id}: ${err instanceof Error ? err.message : String(err)}`
    );
    return res.status(500).json({ error: 'Trust band sync failed' });
  }
});

/**
 * POST /api/v1/privy/webhooks
 *
 * Verified webhook receiver for Privy identity lifecycle events.
 * Guardrail 1: All trust-band scoring happens on the backend.
 * Guardrail 6: Signature verification is strictly enforced before processing.
 *
 * INERT ON THIS ACCOUNT: Privy webhooks are Enterprise-only, so
 * PRIVY_WEBHOOK_SECRET can never be set. Without a secret
 * `verifyPrivyWebhookSignature` returns false and every request is rejected
 * 401 — fail-closed, deliberately. POST /sync above is the live path. This
 * receiver is kept because the scoring/write logic is shared with it and it
 * needs no changes if the account is ever upgraded to Enterprise.
 */
router.post('/webhooks', async (req: Request, res: Response) => {
  const signature =
    (req.headers['privy-webhook-signature'] as string | undefined) ||
    (req.headers['svix-signature'] as string | undefined) ||
    (req.headers['x-privy-webhook-signature'] as string | undefined);

  const timestamp =
    (req.headers['svix-timestamp'] as string | undefined) ||
    (req.headers['privy-webhook-timestamp'] as string | undefined);

  const msgId =
    (req.headers['svix-id'] as string | undefined) ||
    (req.headers['privy-webhook-id'] as string | undefined);

  const rawBody =
    typeof (req as Request & { rawBody?: string }).rawBody === 'string'
      ? (req as Request & { rawBody?: string }).rawBody as string
      : JSON.stringify(req.body ?? {});

  const webhookSecret = process.env.PRIVY_WEBHOOK_SECRET;

  // 1. Verify Webhook Signature
  const isValid = verifyPrivyWebhookSignature({
    rawBody,
    signatureHeader: signature,
    webhookSecret,
    msgId,
    timestamp,
  });

  if (!isValid) {
    logger.warn('[PrivyWebhook] Request rejected due to invalid signature.');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const eventType = req.body?.type;
  if (!eventType || !SUPPORTED_EVENTS.has(eventType)) {
    logger.info(`[PrivyWebhook] Unhandled or ignored event type: ${eventType}`);
    return res.json({ received: true, ignored: true });
  }

  const privyUser: PrivyUserPayload | undefined =
    req.body?.data?.user || req.body?.user;

  if (!privyUser || !privyUser.id) {
    logger.warn('[PrivyWebhook] Event did not contain valid user payload.');
    return res.status(400).json({ error: 'Missing user payload' });
  }

  try {
    // 2. Pure Trust Band Evaluation
    const evaluation = evaluatePrivyTrustBand(privyUser);
    logger.info(
      `[PrivyWebhook] Event '${eventType}' for Privy User ${privyUser.id} -> Band ${evaluation.band} (Score: ${evaluation.score})`
    );

    // 3. Match User in Database (shared with the pull path)
    const userId = await resolvePabandiUserForPrivy(privyUser);

    // 4. Update Database
    if (userId) {
      await applyTrustBandEvaluation({
        userId,
        privyUserId: privyUser.id,
        evaluation,
        source: `webhook:${eventType}`,
      });
    } else {
      logger.info(
        `[PrivyWebhook] No matching Pabandi user found for Privy user ${privyUser.id} yet. Recorded for future link.`
      );
    }

    return res.json({
      success: true,
      privyUserId: privyUser.id,
      band: evaluation.band,
      score: evaluation.score,
      reason: evaluation.reason,
    });
  } catch (err: any) {
    logger.error(`[PrivyWebhook] Processing failed for event ${eventType}: ${err.message}`);
    return res.status(500).json({ error: 'Internal webhook processing failure' });
  }
});

/**
 * GET /api/v1/privy/trust-band
 * Get current trust band rules & scoring configuration
 */
router.get('/trust-band-rules', (_req: Request, res: Response) => {
  res.json({
    success: true,
    rules: {
      bandA: { label: 'Band A (Zero Deposit)', minLinks: 4, requirement: 'At least 4 verified links + Passkey/Phone/MFA' },
      bandB: { label: 'Band B (Low Deposit)', minLinks: 3, requirement: 'At least 3 verified links + OAuth (Google/Apple/GitHub)' },
      bandC: { label: 'Band C (Standard Deposit)', minLinks: 1, requirement: 'At least 1 verified link beyond email' },
      bandD: { label: 'Band D (High Deposit)', minLinks: 0, requirement: 'Email-only or unlinked account' },
    },
  });
});

export default router;
