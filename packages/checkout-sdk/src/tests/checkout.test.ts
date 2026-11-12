import { describe, it, expect, vi } from 'vitest';
import { PabandiCheckout, initCheckout } from '../index';
import { ZkVerifier } from '../core/zkVerifier';
import { generateSvgQrCode } from '../core/qrCodeGenerator';

describe('Pabandi Checkout SDK (@pabandi/checkout-sdk)', () => {
  const validOptions = {
    publishableKey: 'pk_test_pabandi_12345',
    amount: 150.0,
    currency: 'USDC' as const,
    referenceId: 'ref_contract_9876',
    title: 'Commercial Roof Repair Escrow',
  };

  it('validates required configuration options on initialization', () => {
    // Missing publishableKey
    expect(() => new PabandiCheckout({ ...validOptions, publishableKey: '' })).toThrow(
      'publishableKey is required'
    );

    // Missing referenceId
    expect(() => new PabandiCheckout({ ...validOptions, referenceId: '' })).toThrow(
      'referenceId is required'
    );

    // Invalid amount
    expect(() => new PabandiCheckout({ ...validOptions, amount: 0 })).toThrow(
      'amount must be a positive number'
    );
    expect(() => new PabandiCheckout({ ...validOptions, amount: -50 })).toThrow(
      'amount must be a positive number'
    );
  });

  it('initializes instance successfully via factory helper', () => {
    const checkout = initCheckout(validOptions);
    expect(checkout).toBeInstanceOf(PabandiCheckout);
  });

  it('generates a clean SVG QR code with finder patterns and data cells', () => {
    const payload = 'solana:GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre?amount=150.00';
    const svg = generateSvgQrCode(payload, 160);

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 160 160"');
    expect(svg).toContain('width="160"');
    expect(svg).toContain('height="160"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('shape-rendering="crispEdges"');
  });

  it('verifies BBS+ ZK counterparty reputation predicates', async () => {
    const verifier = new ZkVerifier();

    // High reputation counterparty
    const highRepCounterparty = {
      id: 'biz_apex_roofing',
      name: 'Apex Commercial Roofing',
      trustScore: 940,
      disputeRate: 0.3,
    };

    const validResult = await verifier.verify(highRepCounterparty);
    expect(validResult.isValid).toBe(true);
    expect(validResult.score).toBe(940);
    expect(validResult.disputeRate).toBe(0.3);
    expect(validResult.predicatesVerified).toContain('trust_score > 800');
    expect(validResult.predicatesVerified).toContain('dispute_rate < 2%');

    // Failing counterparty (low score, high dispute)
    const lowRepCounterparty = {
      id: 'biz_risky_01',
      name: 'Risky Tradesman',
      trustScore: 650,
      disputeRate: 4.5,
    };

    const invalidResult = await verifier.verify(lowRepCounterparty);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.error).toContain('Counterparty does not meet trust thresholds');
  });
});
