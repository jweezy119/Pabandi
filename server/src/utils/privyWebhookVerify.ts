import crypto from 'crypto';
import { logger } from './logger';

/**
 * Verify Privy webhook signatures.
 * Supports Svix-style (whsec_...) and standard HMAC-SHA256 signatures.
 * 
 * Headers checked:
 * - `privy-webhook-signature` or `svix-signature`
 * - `svix-id` or `privy-webhook-id` (optional timestamp / id anchors)
 * - `svix-timestamp` or `privy-webhook-timestamp`
 */
export function verifyPrivyWebhookSignature(params: {
  rawBody: string;
  signatureHeader?: string;
  webhookSecret?: string;
  msgId?: string;
  timestamp?: string;
}): boolean {
  const { rawBody, signatureHeader, webhookSecret, msgId, timestamp } = params;

  if (!webhookSecret) {
    logger.error('[PrivyWebhook] Missing PRIVY_WEBHOOK_SECRET environment variable.');
    return false;
  }

  if (!signatureHeader) {
    logger.warn('[PrivyWebhook] Missing webhook signature header.');
    return false;
  }

  try {
    // 1. Try Svix-compatible parsing: "t=1234567890,v1=sig..." or "v1,sig..."
    const parts = signatureHeader.split(/[\s,]+/);
    let extractedTimestamp = timestamp || '';
    const signatures: string[] = [];

    for (const part of parts) {
      const [key, val] = part.split('=');
      if (key === 't' && val) {
        extractedTimestamp = val;
      } else if (key === 'v1' && val) {
        signatures.push(val);
      } else if (part.startsWith('v1,')) {
        signatures.push(part.slice(3));
      }
    }

    // Secret handling (Svix keys start with 'whsec_')
    let keyBuffer: Buffer;
    if (webhookSecret.startsWith('whsec_')) {
      const base64Part = webhookSecret.slice(6);
      keyBuffer = Buffer.from(base64Part, 'base64');
    } else {
      keyBuffer = Buffer.from(webhookSecret, 'utf-8');
    }

    // Candidate payloads
    const candidatesToVerify: string[] = [];
    if (msgId && extractedTimestamp) {
      candidatesToVerify.push(`${msgId}.${extractedTimestamp}.${rawBody}`);
    }
    if (extractedTimestamp) {
      candidatesToVerify.push(`${extractedTimestamp}.${rawBody}`);
    }
    candidatesToVerify.push(rawBody);

    for (const candidate of candidatesToVerify) {
      const hmacBase64 = crypto.createHmac('sha256', keyBuffer).update(candidate).digest('base64');
      const hmacHex = crypto.createHmac('sha256', keyBuffer).update(candidate).digest('hex');

      for (const sig of signatures) {
        if (
          crypto.timingSafeEqual(Buffer.from(hmacBase64), Buffer.from(sig)) ||
          crypto.timingSafeEqual(Buffer.from(hmacHex), Buffer.from(sig))
        ) {
          return true;
        }
      }

      // Also check exact signature match if signature was direct
      if (
        signatureHeader === hmacBase64 ||
        signatureHeader === hmacHex ||
        signatureHeader === `v1=${hmacBase64}`
      ) {
        return true;
      }
    }

    logger.warn('[PrivyWebhook] Signature mismatch on incoming webhook payload.');
    return false;
  } catch (err: any) {
    logger.error(`[PrivyWebhook] Signature verification error: ${err.message}`);
    return false;
  }
}
