import { describe, it, expect } from 'vitest';
import { paymentRouter } from '../payment-router.service';
import { raastRail } from '../../payments/rails/raast.rail';

describe('Payment Router Service - recommendRails', () => {
  it('recommends Solana USDC for AI agent callers with maximum savings', () => {
    const estimates = paymentRouter.recommendRails({
      amount: 100,
      currency: 'USD',
      isAgent: true,
    });

    expect(estimates.length).toBeGreaterThanOrEqual(3);
    const top = estimates[0];
    expect(top.rail).toBe('solana');
    expect(top.recommended).toBe(true);
    expect(top.currency).toBe('USDC');
    expect(top.estimatedFee).toBe(0.001);
    expect(top.savingsUsd).toBeGreaterThan(3); // 2.9% + 0.30 = $3.20 card fee saved
  });

  it('recommends Raast for Pakistani domestic transactions', () => {
    const estimates = paymentRouter.recommendRails({
      amount: 28000,
      currency: 'PKR',
      clientCountry: 'PK',
      isAgent: false,
    });

    const raast = estimates.find((e) => e.rail === 'raast');
    expect(raast).toBeDefined();
    expect(raast?.recommended).toBe(true);
    expect(raast?.estimatedFee).toBe(0);
    expect(raast?.currency).toBe('PKR');
  });

  it('recommends Square cards for international non-crypto consumers', () => {
    const estimates = paymentRouter.recommendRails({
      amount: 50,
      currency: 'USD',
      clientCountry: 'US',
      isAgent: false,
    });

    const square = estimates.find((e) => e.rail === 'square');
    expect(square).toBeDefined();
    expect(square?.recommended).toBe(true);
    expect(square?.estimatedFee).toBe(1.75); // 50 * 0.029 + 0.30
  });
});

describe('Raast Rail - Target Validation and URI Generation', () => {
  it('validates Pakistani mobile phone numbers', () => {
    expect(raastRail.validateTarget('03001234567')).toBe(true);
    expect(raastRail.validateTarget('+923001234567')).toBe(true);
    expect(raastRail.validateTarget('923219876543')).toBe(true);
    expect(raastRail.validateTarget('invalid-number')).toBe(false);
  });

  it('validates Pakistani IBANs', () => {
    expect(raastRail.validateTarget('PK36SCBL0000001123456701')).toBe(true);
    expect(raastRail.validateTarget('pk36scbl0000001123456701')).toBe(true);
    expect(raastRail.validateTarget('GB12MIDL40051512345678')).toBe(false);
  });

  it('generates standard raast URI with amount and reference', () => {
    const uri = raastRail.getPaymentUrl('0300-1234567', {
      amount: 5000,
      currency: 'PKR',
      number: 'INV-2026-001',
    });

    expect(uri).toContain('raast:03001234567?amount=5000&ref=INV-2026-001');
  });

  it('converts USD to PKR equivalent in Raast URI if needed', () => {
    const uri = raastRail.getPaymentUrl('03001234567', {
      amount: 10,
      currency: 'USD',
      reference: 'INV-USD',
    });

    expect(uri).toContain('amount=2800'); // 10 * 280
  });
});

