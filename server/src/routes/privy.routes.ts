import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { verifyPrivyWebhookSignature } from '../utils/privyWebhookVerify';
import { evaluatePrivyTrustBand, PrivyUserPayload } from '../services/privyTrustScoring';

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
 * POST /api/v1/privy/webhooks
 * 
 * Verified webhook receiver for Privy identity lifecycle events.
 * Guardrail 1: All trust-band scoring happens on the backend driven by Privy webhooks.
 * Guardrail 6: Signature verification is strictly enforced before processing.
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

    // 3. Match User in Database
    // Try matching by Privy UserAuthMethod first
    let authMethod = await prisma.userAuthMethod.findUnique({
      where: {
        provider_providerId: {
          provider: 'privy',
          providerId: privyUser.id,
        },
      },
      include: { user: true },
    });

    let userId = authMethod?.userId;

    // Fallback: match by email from linked accounts
    if (!userId) {
      const accounts = privyUser.linkedAccounts || privyUser.linked_accounts || [];
      const emailAcc = accounts.find(
        (a) => (a.type === 'email' || a.type === 'google_oauth') && typeof a.address === 'string'
      );
      const email = (emailAcc?.address as string | undefined) || (emailAcc?.email as string | undefined);

      if (email) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          userId = existingUser.id;
        }
      }
    }

    // Fallback: match by wallet address
    if (!userId) {
      const accounts = privyUser.linkedAccounts || privyUser.linked_accounts || [];
      const walletAcc = accounts.find((a) => a.type === 'wallet' && typeof a.address === 'string');
      const walletAddress = walletAcc?.address as string | undefined;

      if (walletAddress) {
        const existingUser = await prisma.user.findUnique({ where: { walletAddress } });
        if (existingUser) {
          userId = existingUser.id;
        }
      }
    }

    // 4. Update Database
    if (userId) {
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
            provider_providerId: {
              provider: 'privy',
              providerId: privyUser.id,
            },
          },
          update: {
            metadata: {
              trustBand: evaluation.band,
              trustScore: evaluation.score,
              reason: evaluation.reason,
              totalLinks: evaluation.totalLinks,
              lastEvent: eventType,
              updatedAt: new Date().toISOString(),
            },
            lastUsedAt: new Date(),
          },
          create: {
            userId,
            provider: 'privy',
            providerId: privyUser.id,
            metadata: {
              trustBand: evaluation.band,
              trustScore: evaluation.score,
              reason: evaluation.reason,
              totalLinks: evaluation.totalLinks,
              lastEvent: eventType,
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      ]);

      // If user has a TrustPassport, update its score and riskBand
      await prisma.trustPassport.updateMany({
        where: { userId },
        data: {
          score: evaluation.score,
          riskBand: evaluation.band,
        },
      }).catch((passportErr) => {
        logger.warn(`[PrivyWebhook] Could not update TrustPassport for user ${userId}: ${passportErr}`);
      });

      logger.info(
        `[PrivyWebhook] Successfully synced Trust Band ${evaluation.band} for Pabandi User ${userId}.`
      );
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
