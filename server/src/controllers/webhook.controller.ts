import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { getRedis } from '../lib/redis';
import { logger } from '../utils/logger';

// In-memory cache for webhook deduplication when Redis is offline
const memoryWebhookEvents = new Map<string, number>();

export function clearWebhookEventStore(): void {
  memoryWebhookEvents.clear();
}

/**
 * Checks if a webhook event ID has already been processed (idempotency check).
 */
export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  if (!eventId) return false;

  const redis = await getRedis();
  if (redis) {
    try {
      const exists = await redis.get(`webhook:event:${eventId}`);
      return exists !== null;
    } catch (err) {
      logger.warn(`[WebhookIdempotency] Redis lookup failed: ${String(err)}`);
    }
  }

  const expiresAt = memoryWebhookEvents.get(eventId);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    memoryWebhookEvents.delete(eventId);
    return false;
  }
  return true;
}

/**
 * Marks a webhook event ID as processed with a default 72-hour TTL.
 */
export async function markWebhookProcessed(eventId: string, ttlSeconds = 259200): Promise<void> {
  if (!eventId) return;

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(`webhook:event:${eventId}`, 'processed', 'EX', ttlSeconds);
      return;
    } catch (err) {
      logger.warn(`[WebhookIdempotency] Redis set failed: ${String(err)}`);
    }
  }

  memoryWebhookEvents.set(eventId, Date.now() + ttlSeconds * 1000);
}

/**
 * Timing-safe HMAC signature verification.
 */
export function verifyHmacSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string,
  algorithm = 'sha256',
  encoding: 'hex' | 'base64' = 'hex'
): boolean {
  if (!rawBody || !signature || !secret) return false;

  try {
    const computed = crypto.createHmac(algorithm, secret).update(rawBody).digest(encoding);
    const sigBuf = Buffer.from(signature, encoding);
    const compBuf = Buffer.from(computed, encoding);

    if (sigBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, compBuf);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// External Webhook Handlers with Timing-Safe HMAC & Idempotency
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles incoming Square payment webhooks with HMAC & event idempotency.
 */
export const handleExternalSquareWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature =
      (req.headers['x-square-hmacsha256-signature'] as string | undefined) ||
      (req.headers['x-square-signature'] as string | undefined);
    const secret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || process.env.SQUARE_WEBHOOK_SECRET || '';

    const rawBody =
      (req as Request & { rawBody?: Buffer | string }).rawBody?.toString('utf8') ||
      JSON.stringify(req.body ?? {});

    if (secret) {
      const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const payloadToSign = `${webhookUrl}${rawBody}`;
      const isValid = verifyHmacSignature(payloadToSign, signature || '', secret, 'sha256', 'base64');

      if (!isValid) {
        logger.warn(`[SquareWebhook] Invalid HMAC signature for ${webhookUrl}`);
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const eventId = req.body?.event_id || req.body?.id;
    if (eventId) {
      const alreadyProcessed = await isWebhookProcessed(eventId);
      if (alreadyProcessed) {
        logger.info(`[SquareWebhook] Duplicate event ${eventId} acknowledged without side-effects`);
        return res.status(200).json({ received: true, duplicate: true });
      }
      await markWebhookProcessed(eventId);
    }

    return res.status(200).json({ received: true, processed: true });
  } catch (err) {
    next(err);
  }
};

/**
 * Handles incoming Stripe payment webhooks with HMAC & event idempotency.
 */
export const handleExternalStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';

    const rawBody =
      (req as Request & { rawBody?: Buffer | string }).rawBody?.toString('utf8') ||
      JSON.stringify(req.body ?? {});

    if (secret && signature) {
      // Parse timestamp and v1 signatures from Stripe-Signature header
      const parts = signature.split(',').reduce<Record<string, string>>((acc, item) => {
        const [k, v] = item.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const timestamp = parts['t'];
      const v1Sig = parts['v1'];

      if (!timestamp || !v1Sig) {
        return res.status(401).json({ error: 'Malformed stripe-signature header' });
      }

      const payload = `${timestamp}.${rawBody}`;
      const isValid = verifyHmacSignature(payload, v1Sig, secret, 'sha256', 'hex');
      if (!isValid) {
        logger.warn('[StripeWebhook] Invalid HMAC signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const eventId = req.body?.id;
    if (eventId) {
      const alreadyProcessed = await isWebhookProcessed(eventId);
      if (alreadyProcessed) {
        logger.info(`[StripeWebhook] Duplicate event ${eventId} acknowledged`);
        return res.status(200).json({ received: true, duplicate: true });
      }
      await markWebhookProcessed(eventId);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
};

/**
 * Handles incoming SafePay payment webhooks with HMAC & event idempotency.
 */
export const handleExternalSafepayWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature =
      (req.headers['x-safepay-signature'] as string | undefined) ||
      (req.headers['x-sfpy-signature'] as string | undefined);
    const secret = process.env.SAFEPAY_WEBHOOK_SECRET || '';

    const rawBody =
      (req as Request & { rawBody?: Buffer | string }).rawBody?.toString('utf8') ||
      JSON.stringify(req.body ?? {});

    if (secret) {
      const isValid = verifyHmacSignature(rawBody, signature || '', secret, 'sha256', 'hex');
      if (!isValid) {
        logger.warn('[SafePayWebhook] Invalid HMAC signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const eventId = req.body?.data?.tracker || req.body?.id || req.body?.token;
    if (eventId) {
      const alreadyProcessed = await isWebhookProcessed(eventId);
      if (alreadyProcessed) {
        logger.info(`[SafePayWebhook] Duplicate tracker ${eventId} acknowledged`);
        return res.status(200).json({ received: true, duplicate: true });
      }
      await markWebhookProcessed(eventId);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// User-Managed Webhook CRUD Endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const createWebhook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { targetUrl, subscribedEvents } = req.body;

    const business = await prisma.business.findUnique({
      where: { ownerId: req.user!.id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    const signingSecret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        businessId: business.id,
        targetUrl,
        subscribedEvents: subscribedEvents || ['*'],
        signingSecret,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Webhook endpoint created successfully',
      data: { webhook },
    });
  } catch (error) {
    next(error);
  }
};

export const getWebhooks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user!.id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { webhooks },
    });
  } catch (error) {
    next(error);
  }
};

export const updateWebhook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { targetUrl, subscribedEvents, isActive } = req.body;

    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!webhook) {
      throw new CustomError('Webhook not found', 404);
    }

    if (webhook.business.ownerId !== req.user!.id) {
      throw new CustomError('Unauthorized', 403);
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        targetUrl,
        subscribedEvents,
        isActive,
      },
    });

    res.json({
      success: true,
      message: 'Webhook updated successfully',
      data: { webhook: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWebhook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!webhook) {
      throw new CustomError('Webhook not found', 404);
    }

    if (webhook.business.ownerId !== req.user!.id) {
      throw new CustomError('Unauthorized', 403);
    }

    await prisma.webhookEndpoint.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const regenerateSecret = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!webhook) {
      throw new CustomError('Webhook not found', 404);
    }

    if (webhook.business.ownerId !== req.user!.id) {
      throw new CustomError('Unauthorized', 403);
    }

    const newSecret = crypto.randomBytes(32).toString('hex');

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        signingSecret: newSecret,
      },
    });

    res.json({
      success: true,
      message: 'Webhook secret regenerated successfully',
      data: { signingSecret: updated.signingSecret },
    });
  } catch (error) {
    next(error);
  }
};
