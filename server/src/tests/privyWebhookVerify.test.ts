import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyPrivyWebhookSignature } from '../utils/privyWebhookVerify';

describe('verifyPrivyWebhookSignature', () => {
  const secret = 'whsec_dGVzdHNlY3JldDEyMzQ1Njc4OTA=';
  const rawBody = JSON.stringify({ type: 'user.linked_account', data: { user: { id: 'did:privy:123' } } });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const msgId = 'msg_123456';

  it('verifies valid signature with svix format', () => {
    const key = Buffer.from(secret.slice(6), 'base64');
    const signedContent = `${msgId}.${timestamp}.${rawBody}`;
    const sig = crypto.createHmac('sha256', key).update(signedContent).digest('base64');
    const header = `t=${timestamp},v1=${sig}`;

    const isValid = verifyPrivyWebhookSignature({
      rawBody,
      signatureHeader: header,
      webhookSecret: secret,
      msgId,
      timestamp,
    });

    expect(isValid).toBe(true);
  });

  it('rejects invalid or tampered signature', () => {
    const header = `t=${timestamp},v1=invalid_signature_here`;
    const isValid = verifyPrivyWebhookSignature({
      rawBody,
      signatureHeader: header,
      webhookSecret: secret,
      msgId,
      timestamp,
    });

    expect(isValid).toBe(false);
  });

  it('rejects when webhook secret is missing', () => {
    const isValid = verifyPrivyWebhookSignature({
      rawBody,
      signatureHeader: 'v1=something',
      webhookSecret: undefined,
    });

    expect(isValid).toBe(false);
  });
});
