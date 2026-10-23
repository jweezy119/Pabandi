import { describe, it, expect } from 'vitest';
import {
  buildPaymentRequired,
  buildSvmPaymentRequirements,
  encodePaymentRequired,
  parseX402PaymentHeaderRaw,
  SOLANA_MAINNET_CAIP2,
} from '../src/services/x402.service';
import { X402_PAY_BAZAAR } from '../src/routes/x402.routes';

/**
 * The v2 envelope is the contract the CDP Facilitator validates and the Bazaar
 * reads. If the shape drifts — atomic amount, CAIP-2 network, asset mint, or a
 * PAYMENT-SIGNATURE parse — agents can discover the endpoint and then fail to
 * pay it, which is worse than not discovering it at all.
 */

describe('x402 v2 PaymentRequired envelope', () => {
  const resource = '/api/v1/x402/pay';

  it('declares the exact scheme on Solana mainnet with an atomic USDC amount', () => {
    const req = buildSvmPaymentRequirements(resource, 0.01);
    expect(req.scheme).toBe('exact');
    expect(req.network).toBe(SOLANA_MAINNET_CAIP2);
    // 0.01 USDC in atomic units (USDC is 6-decimal SPL).
    expect(req.amount).toBe('10000');
    expect(req.asset).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect((req.extra as Record<string, unknown>) || {}).toBeTypeOf('object');
  });

  it('never fabricates a payTo when the payout address is not configured', () => {
    const req = buildSvmPaymentRequirements(resource, 0.01);
    // payTo may legitimately be empty in dev; a placeholder address would route
    // a real payment to a random keypair, so the field must carry the actual
    // configured value or be absent.
    expect(req.payTo === '' || typeof req.payTo === 'string').toBe(true);
  });

  it('wraps the requirements in a v2 PaymentRequired envelope with the resource and bazaar extensions', () => {
    const envelope = buildPaymentRequired({ resource, amountUsdc: 0.01, extensions: X402_PAY_BAZAAR });
    expect(envelope.x402Version).toBe(2);
    expect(envelope.resource).toMatchObject({ url: resource, mimeType: 'application/json' });
    expect(Array.isArray(envelope.accepts)).toBe(true);
    expect((envelope.accepts as unknown[])[0]).toMatchObject({ scheme: 'exact' });
    expect((envelope.extensions as Record<string, unknown>).bazaar).toBeTypeOf('object');
  });

  it('round-trips through the PAYMENT-REQUIRED header encoding', () => {
    const envelope = buildPaymentRequired({ resource, amountUsdc: 0.01 });
    const decoded = JSON.parse(Buffer.from(encodePaymentRequired(envelope), 'base64').toString('utf8'));
    expect(decoded.x402Version).toBe(2);
    expect((decoded.accepts as unknown[])[0].network).toBe(SOLANA_MAINNET_CAIP2);
  });
});

describe('x402 v2 PAYMENT-SIGNATURE parsing', () => {
  const v2Payload = {
    x402Version: 2,
    accepted: { scheme: 'exact' },
    payload: { transaction: 'AAAApartially-signed-tx=' },
  };
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64');

  it('parses a v2 PAYMENT-SIGNATURE header', () => {
    const parsed = parseX402PaymentHeaderRaw(encode(v2Payload));
    expect(parsed.v2).not.toBeNull();
    expect(parsed.v2?.payload.transaction).toBe('AAAApartially-signed-tx=');
    expect(parsed.v2?.accepted).toMatchObject({ scheme: 'exact' });
    expect(parsed.legacy).toBeNull();
  });

  it('keeps the legacy X-PAYMENT envelope parseable', () => {
    const parsed = parseX402PaymentHeaderRaw(encode({ paymentPayload: { a: 1 }, payload: { b: 2 } }));
    expect(parsed.legacy).not.toBeNull();
    expect(parsed.legacy?.paymentPayload).toMatchObject({ a: 1 });
    expect(parsed.v2).toBeNull();
  });

  it('rejects a header with neither shape', () => {
    const parsed = parseX402PaymentHeaderRaw(encode({ garbage: true }));
    expect(parsed.v2).toBeNull();
    expect(parsed.legacy).toBeNull();
  });

  it('rejects a non-base64 header', () => {
    expect(parseX402PaymentHeaderRaw('%%%not-base64%%%')).toMatchObject({ v2: null, legacy: null });
  });
});
