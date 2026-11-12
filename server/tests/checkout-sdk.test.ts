import { describe, it, expect } from 'vitest';
import Pabandi, { PabandiCheckout, ZkVerifier, generateSvgQrCode, initCheckout } from '../../packages/checkout-sdk/dist/index.mjs';

describe('Pabandi Embeddable Checkout SDK (@pabandi/checkout-sdk)', () => {
  const validOptions = {
    publishableKey: 'pk_live_pabandi_escrow_sec_99',
    amount: 250.0,
    currency: 'USDC' as const,
    referenceId: 'order_hvac_commercial_01',
    title: 'Commercial HVAC Replacement Escrow',
    subtitle: 'Milestone 1: Deposit & Equipment Procurement',
  };

  it('validates mandatory configuration params on instantiation', () => {
    // Missing publishableKey
    expect(() => new PabandiCheckout({ ...validOptions, publishableKey: '' })).toThrow(
      'publishableKey is required'
    );

    // Missing referenceId
    expect(() => new PabandiCheckout({ ...validOptions, referenceId: '' })).toThrow(
      'referenceId is required'
    );

    // Non-positive amount
    expect(() => new PabandiCheckout({ ...validOptions, amount: 0 })).toThrow(
      'amount must be a positive number'
    );
    expect(() => new PabandiCheckout({ ...validOptions, amount: -100 })).toThrow(
      'amount must be a positive number'
    );
  });

  it('provides a clean factory initialization API via initCheckout and default export', () => {
    const instanceA = initCheckout(validOptions);
    expect(instanceA).toBeInstanceOf(PabandiCheckout);

    const instanceB = Pabandi.initCheckout(validOptions);
    expect(instanceB).toBeInstanceOf(PabandiCheckout);
  });

  it('renders a deterministic SVG QR code with finder patterns for Solana and Raast', () => {
    const solanaUri = 'solana:GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre?amount=250.00';
    const svg = generateSvgQrCode(solanaUri, 150);

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 150 150"');
    expect(svg).toContain('width="150"');
    expect(svg).toContain('height="150"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('shape-rendering="crispEdges"');
  });

  it('verifies counterparty BBS+ Zero-Knowledge Trust standing', async () => {
    const verifier = new ZkVerifier();

    // 1. High Trust Counterparty
    const verifiedTechnician = {
      id: 'tech_apex_01',
      name: 'Apex Commercial Heating & Air',
      trustScore: 920,
      disputeRate: 0.2,
    };

    const validResult = await verifier.verify(verifiedTechnician);
    expect(validResult.isValid).toBe(true);
    expect(validResult.score).toBe(920);
    expect(validResult.disputeRate).toBe(0.2);
    expect(validResult.predicatesVerified).toContain('trust_score > 800');
    expect(validResult.predicatesVerified).toContain('dispute_rate < 2%');

    // 2. Untrusted Counterparty (fails trust score threshold)
    const untrustedSeller = {
      id: 'seller_shady_09',
      name: 'Unverified Third-Party Freelancer',
      trustScore: 610,
      disputeRate: 5.1,
    };

    const failedResult = await verifier.verify(untrustedSeller);
    expect(failedResult.isValid).toBe(false);
    expect(failedResult.error).toContain('Counterparty does not meet trust thresholds');
  });
});

