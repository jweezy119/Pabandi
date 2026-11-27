import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface WebhookVerificationResult {
  verified: boolean;
  provider: string;
  eventType?: string;
  payload?: any;
  error?: string;
}

export type WebhookVerifier = (req: Request) => Promise<WebhookVerificationResult>;

const verifiers = new Map<string, WebhookVerifier>();

export function registerWebhookVerifier(provider: string, verifier: WebhookVerifier): void {
  verifiers.set(provider.toLowerCase(), verifier);
}

export function getWebhookVerifier(provider: string): WebhookVerifier | undefined {
  return verifiers.get(provider.toLowerCase());
}

export async function verifyWebhook(provider: string, req: Request): Promise<WebhookVerificationResult> {
  const verifier = getWebhookVerifier(provider);
  if (!verifier) {
    logger.warn(`[WebhookVerifier] No verifier registered for provider: ${provider}`);
    return { verified: false, provider, error: `No verifier for provider: ${provider}` };
  }
  return verifier(req);
}

/**
 * timingSafeEqual throws on unequal buffer lengths. An attacker-controlled
 * signature header could therefore turn a rejected webhook into a 500 — and a
 * 500 retries (or is mistaken for a provider outage) while a 401 is definitive.
 * Compare only after checking both shape and length.
 */
function safeHexCompare(provided: string, expected: string): boolean {
  if (!/^[0-9a-f]+$/i.test(provided)) return false;
  const providedBuf = Buffer.from(provided, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export function verifyHmacSha256(payload: string | Buffer, secret: string, providedSignature: string): boolean {
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return safeHexCompare(providedSignature, expectedSignature);
}

export function verifyHmacSha1(payload: string | Buffer, secret: string, providedSignature: string): boolean {
  const expectedSignature = crypto.createHmac('sha1', secret).update(payload).digest('hex');
  return safeHexCompare(providedSignature, expectedSignature);
}

export function parseStripeSignature(header: string): { timestamp: number; signatures: string[] } | null {
  const parts = header.split(',').map(p => p.trim());
  let timestamp = 0;
  const signatures: string[] = [];
  
  for (const part of parts) {
    if (part.startsWith('t=')) {
      timestamp = parseInt(part.slice(2), 10);
    } else if (part.startsWith('v1=')) {
      signatures.push(part.slice(3));
    }
  }
  
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export function buildStripeSignedPayload(timestamp: number, payload: string | Buffer): string {
  return `${timestamp}.${payload}`;
}

export function verifyStripeWebhook(req: Request, secret: string): WebhookVerificationResult {
  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    return { verified: false, provider: 'stripe', error: 'Missing stripe-signature header' };
  }

  const parsed = parseStripeSignature(signature);
  if (!parsed) {
    return { verified: false, provider: 'stripe', error: 'Invalid stripe-signature format' };
  }

  const { timestamp, signatures } = parsed;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return { verified: false, provider: 'stripe', error: 'Timestamp too old' };
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    return { verified: false, provider: 'stripe', error: 'Missing raw body for verification' };
  }

  const signedPayload = buildStripeSignedPayload(timestamp, rawBody);
  
  for (const sig of signatures) {
    if (verifyHmacSha256(signedPayload, secret, sig)) {
      try {
        const event = JSON.parse(rawBody.toString());
        return { verified: true, provider: 'stripe', eventType: event.type, payload: event };
      } catch {
        return { verified: true, provider: 'stripe', payload: rawBody };
      }
    }
  }

  return { verified: false, provider: 'stripe', error: 'No valid signature found' };
}

export function verifySquareWebhook(req: Request, secret: string): WebhookVerificationResult {
  const signature = req.headers['x-square-hmacsha256-signature'] as string;
  if (!signature) {
    return { verified: false, provider: 'square', error: 'Missing x-square-hmacsha256-signature header' };
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    return { verified: false, provider: 'square', error: 'Missing raw body for verification' };
  }

  const bodyString = rawBody.toString();
  const isValid = verifyHmacSha256(bodyString, secret, signature);
  
  if (!isValid) {
    return { verified: false, provider: 'square', error: 'Invalid signature' };
  }

  try {
    const event = JSON.parse(bodyString);
    return { verified: true, provider: 'square', eventType: event.type, payload: event };
  } catch {
    return { verified: true, provider: 'square', payload: bodyString };
  }
}

export function verifyPayLioWebhook(req: Request, secret: string): WebhookVerificationResult {
  // Accept both header spellings the old inline verifier accepted, so enabling
  // mandatory verification does not silently break an existing integration.
  const signature = (req.headers['x-paylio-signature'] || req.headers['x-webhook-signature']) as string;
  if (!signature) {
    return { verified: false, provider: 'paylio', error: 'Missing x-paylio-signature header' };
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    return { verified: false, provider: 'paylio', error: 'Missing raw body for verification' };
  }

  const bodyString = rawBody.toString();
  const isValid = verifyHmacSha256(bodyString, secret, signature);
  
  if (!isValid) {
    return { verified: false, provider: 'paylio', error: 'Invalid signature' };
  }

  try {
    const event = JSON.parse(bodyString);
    return { verified: true, provider: 'paylio', eventType: event.event_type, payload: event };
  } catch {
    return { verified: true, provider: 'paylio', payload: bodyString };
  }
}

export function verifyBTCPayWebhook(req: Request, secret: string): WebhookVerificationResult {
  const signature = req.headers['btcpay-sig'] as string;
  if (!signature) {
    return { verified: false, provider: 'btcpay', error: 'Missing btcpay-sig header' };
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    return { verified: false, provider: 'btcpay', error: 'Missing raw body for verification' };
  }

  const bodyString = rawBody.toString();
  const isValid = verifyHmacSha256(bodyString, secret, signature);
  
  if (!isValid) {
    return { verified: false, provider: 'btcpay', error: 'Invalid signature' };
  }

  try {
    const event = JSON.parse(bodyString);
    return { verified: true, provider: 'btcpay', eventType: event.type, payload: event };
  } catch {
    return { verified: true, provider: 'btcpay', payload: bodyString };
  }
}

export function verifyRaastWebhook(req: Request, secret: string): WebhookVerificationResult {
  const signature = req.headers['x-raast-signature'] as string;
  if (!signature) {
    return { verified: false, provider: 'raast', error: 'Missing x-raast-signature header' };
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    return { verified: false, provider: 'raast', error: 'Missing raw body for verification' };
  }

  const bodyString = rawBody.toString();
  const isValid = verifyHmacSha256(bodyString, secret, signature);
  
  if (!isValid) {
    return { verified: false, provider: 'raast', error: 'Invalid signature' };
  }

  try {
    const event = JSON.parse(bodyString);
    return { verified: true, provider: 'raast', eventType: event.event_type, payload: event };
  } catch {
    return { verified: true, provider: 'raast', payload: bodyString };
  }
}

export function verifyGenericHmacWebhook(
  req: Request,
  secret: string,
  signatureHeader: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): WebhookVerificationResult {
  const signature = req.headers[signatureHeader.toLowerCase()] as string;
  if (!signature) {
    return { verified: false, provider: 'generic', error: `Missing ${signatureHeader} header` };
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    return { verified: false, provider: 'generic', error: 'Missing raw body for verification' };
  }

  const bodyString = rawBody.toString();
  const isValid = algorithm === 'sha256'
    ? verifyHmacSha256(bodyString, secret, signature)
    : verifyHmacSha1(bodyString, secret, signature);
  
  if (!isValid) {
    return { verified: false, provider: 'generic', error: 'Invalid signature' };
  }

  try {
    const event = JSON.parse(bodyString);
    return { verified: true, provider: 'generic', eventType: event.type || event.event_type, payload: event };
  } catch {
    return { verified: true, provider: 'generic', payload: bodyString };
  }
}

registerWebhookVerifier('stripe', async (req) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret) return { verified: false, provider: 'stripe', error: 'STRIPE_WEBHOOK_SECRET not configured' };
  return verifyStripeWebhook(req, secret);
});

registerWebhookVerifier('square', async (req) => {
  const secret = process.env.SQUARE_WEBHOOK_SECRET || '';
  if (!secret) return { verified: false, provider: 'square', error: 'SQUARE_WEBHOOK_SECRET not configured' };
  return verifySquareWebhook(req, secret);
});

registerWebhookVerifier('paylio', async (req) => {
  const secret = process.env.PAYLIO_WEBHOOK_SECRET || '';
  if (!secret) return { verified: false, provider: 'paylio', error: 'PAYLIO_WEBHOOK_SECRET not configured' };
  return verifyPayLioWebhook(req, secret);
});

registerWebhookVerifier('btcpay', async (req) => {
  const secret = process.env.BTCPAY_WEBHOOK_SECRET || '';
  if (!secret) return { verified: false, provider: 'btcpay', error: 'BTCPAY_WEBHOOK_SECRET not configured' };
  return verifyBTCPayWebhook(req, secret);
});

registerWebhookVerifier('raast', async (req) => {
  const secret = process.env.RAAST_WEBHOOK_SECRET || '';
  if (!secret) return { verified: false, provider: 'raast', error: 'RAAST_WEBHOOK_SECRET not configured' };
  return verifyRaastWebhook(req, secret);
});

export const webhookVerifierMiddleware = (provider: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await verifyWebhook(provider, req);
    if (!result.verified) {
      logger.warn(`[WebhookVerifier] ${provider} verification failed: ${result.error}`);
      return res.status(401).json({ success: false, error: `Webhook verification failed: ${result.error}` });
    }
    (req as any).webhookEvent = result;
    next();
  };
};