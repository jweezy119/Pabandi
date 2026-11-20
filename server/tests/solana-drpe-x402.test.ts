import { describe, it, expect } from 'vitest';
import { calculateDrpeQuote } from '../src/routes/solanaUsdc.routes';
import { SolanaAdapter } from '../src/services/payment-adapters/solana.adapter';

describe('Solana DRPE Trust-Pricing Parity & x402 Settlement', () => {
  it('computes Platinum tier (score >= 95): 10% deposit, 0.30% fee, 90% capital unlocked', () => {
    const q = calculateDrpeQuote(98, 250);
    expect(q.tier).toBe('Platinum');
    expect(q.depositPercent).toBe(10);
    expect(q.feePercent).toBe(0.3);
    expect(q.depositRequired).toBe(25);
    expect(q.platformFee).toBe(0.75);
    expect(q.capitalUnlocked).toBe(225);
    expect(q.supportedAssets).toEqual(['USDC', 'CASH']);
  });

  it('computes Gold tier (score 80..94): 25% deposit, 0.80% fee, 75% capital unlocked', () => {
    const q = calculateDrpeQuote(85, 100);
    expect(q.tier).toBe('Gold');
    expect(q.depositPercent).toBe(25);
    expect(q.feePercent).toBe(0.8);
    expect(q.depositRequired).toBe(25);
    expect(q.platformFee).toBe(0.8);
    expect(q.capitalUnlocked).toBe(75);
  });

  it('computes Standard tier (score 50..79): 100% deposit, 1.50% fee', () => {
    const q = calculateDrpeQuote(60, 100);
    expect(q.tier).toBe('Standard');
    expect(q.depositPercent).toBe(100);
    expect(q.feePercent).toBe(1.5);
    expect(q.depositRequired).toBe(100);
    expect(q.platformFee).toBe(1.5);
    expect(q.capitalUnlocked).toBe(0);
  });

  it('computes New tier (score < 50): 100% deposit, 2.50% fee', () => {
    const q = calculateDrpeQuote(20, 100);
    expect(q.tier).toBe('New');
    expect(q.depositPercent).toBe(100);
    expect(q.feePercent).toBe(2.5);
    expect(q.depositRequired).toBe(100);
    expect(q.platformFee).toBe(2.5);
  });

  it('generates x402 v2 challenge for Phantom CASH (Token-2022) and USDC (SPL Token)', async () => {
    const adapter = new SolanaAdapter();

    const cashCheckout = await adapter.createAgentCheckout('x402', {
      amount: 12.5,
      asset: 'CASH',
      resource: '/mcp/book',
    });
    expect(cashCheckout.success).toBe(true);
    expect(cashCheckout.challenge?.x402Version).toBe(2);
    expect(cashCheckout.challenge?.asset).toBe('CASH');
    expect(cashCheckout.challenge?.mint).toBe('CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH');
    expect(cashCheckout.challenge?.tokenProgram).toBe('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
    expect(cashCheckout.challenge?.maxAmountRequired).toBe('12500000');
    expect(cashCheckout.challenge?.network).toMatch(/^solana:/);
    expect(cashCheckout.challenge?.acceptedAssets).toHaveLength(2);

    const usdcCheckout = await adapter.createAgentCheckout('x402', {
      amount: 5,
      asset: 'USDC',
    });
    expect(usdcCheckout.success).toBe(true);
    expect(usdcCheckout.challenge?.asset).toBe('USDC');
    expect(usdcCheckout.challenge?.tokenProgram).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    expect(usdcCheckout.challenge?.maxAmountRequired).toBe('5000000');
  });

  it('generates Solana Pay URI with spl-token for non-x402 agent checkout', async () => {
    const adapter = new SolanaAdapter();
    const res = await adapter.createAgentCheckout('ucp', {
      amount: 10,
      asset: 'CASH',
    });
    expect(res.success).toBe(true);
    expect(res.checkoutUrl).toContain('solana:');
    expect(res.checkoutUrl).toContain('spl-token=CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH');
  });
});
