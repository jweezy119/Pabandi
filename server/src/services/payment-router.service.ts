import { PaymentAdapter, PaymentContext } from './payment-adapters/types';
import { StripeAdapter } from './payment-adapters/stripe.adapter';
import { SquareAdapter } from './payment-adapters/square.adapter';
import { SolanaAdapter } from './payment-adapters/solana.adapter';
import { ShopifyAdapter } from './payment-adapters/shopify.adapter';

export interface RailEstimate {
  rail: 'solana' | 'raast' | 'square' | 'stripe' | 'wallets';
  name: string;
  currency: string;
  amount: number;
  estimatedFee: number;
  netSettlement: number;
  settlementSpeed: 'instant (<1s)' | 'instant (<5s)' | 'standard (1-2 days)';
  savingsUsd: number;
  recommended: boolean;
  badge: string;
  reason: string;
}

const PKR_PER_USD = 280;

export class PaymentRouterService {
  private adapters: Map<string, PaymentAdapter> = new Map();

  constructor() {
    this.adapters.set('stripe', new StripeAdapter());
    this.adapters.set('square', new SquareAdapter());
    this.adapters.set('solana', new SolanaAdapter());
    this.adapters.set('shopify', new ShopifyAdapter());
  }

  /**
   * Intelligently selects the best adapter for direct processing
   */
  selectAdapter(context: PaymentContext): PaymentAdapter {
    if (context.isAgent && (context.currency === 'USDC' || context.currency === 'SOL')) {
      return this.adapters.get('solana')!;
    }
    if (context.metadata?.source === 'shopify') {
      return this.adapters.get('shopify')!;
    }
    if (context.currency === 'PKR' || context.clientCountry === 'PK') {
      return this.adapters.get('square')!; // local card processing fallback
    }
    if (context.currency === 'USD' && context.clientCountry === 'US') {
      return this.adapters.get('stripe')!;
    }
    return this.adapters.get('square')!;
  }

  getAdapter(id: string): PaymentAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Computes dynamic fee comparison and smart rail recommendations
   * for zero-friction user checkout decision.
   */
  recommendRails(context: PaymentContext): RailEstimate[] {
    const isPkr = context.currency.toUpperCase() === 'PKR';
    const amountUsd = isPkr ? context.amount / PKR_PER_USD : context.amount;
    const amountPkr = isPkr ? context.amount : Math.round(context.amount * PKR_PER_USD);

    // Baseline Card Fee (Stripe/Square): 2.9% + $0.30
    const standardCardFee = Math.round((amountUsd * 0.029 + 0.3) * 100) / 100;

    const estimates: RailEstimate[] = [];

    // 1. Solana USDC (0% Merchant Fee, ~0.001 network gas)
    const solanaFee = 0.001;
    estimates.push({
      rail: 'solana',
      name: 'Solana USDC Escrow',
      currency: 'USDC',
      amount: Math.round(amountUsd * 100) / 100,
      estimatedFee: solanaFee,
      netSettlement: Math.round((amountUsd - solanaFee) * 100) / 100,
      settlementSpeed: 'instant (<1s)',
      savingsUsd: Math.max(0, Math.round((standardCardFee - solanaFee) * 100) / 100),
      recommended: context.isAgent || context.currency === 'USDC',
      badge: '0% FX · Instant Escrow',
      reason: 'Programmable smart contract escrow with sub-second finality and zero conversion markup.',
    });

    // 2. Raast Instant (0% State Bank of Pakistan fee)
    estimates.push({
      rail: 'raast',
      name: 'Raast Direct Bank Transfer',
      currency: 'PKR',
      amount: amountPkr,
      estimatedFee: 0,
      netSettlement: amountPkr,
      settlementSpeed: 'instant (<5s)',
      savingsUsd: Math.round(standardCardFee * 100) / 100,
      recommended: context.clientCountry === 'PK' || context.currency === 'PKR',
      badge: '0% Fee · SBP Instant',
      reason: 'State Bank of Pakistan zero-fee national rail. Supported by all Pakistani bank apps.',
    });

    // 3. Square Checkout (Cards, Apple Pay, Google Pay)
    const squareFee = standardCardFee;
    estimates.push({
      rail: 'square',
      name: 'Square (Cards, Apple/Google Pay)',
      currency: 'USD',
      amount: Math.round(amountUsd * 100) / 100,
      estimatedFee: squareFee,
      netSettlement: Math.round((amountUsd - squareFee) * 100) / 100,
      settlementSpeed: 'standard (1-2 days)',
      savingsUsd: 0,
      recommended: !context.isAgent && context.clientCountry !== 'PK' && context.currency !== 'USDC',
      badge: 'Universal Cards',
      reason: 'Accepts all major debit & credit cards, Apple Pay, Google Pay, and Cash App.',
    });

    // 4. Pakistani Mobile Wallets (JazzCash & EasyPaisa)
    estimates.push({
      rail: 'wallets',
      name: 'JazzCash / EasyPaisa',
      currency: 'PKR',
      amount: amountPkr,
      estimatedFee: 0,
      netSettlement: amountPkr,
      settlementSpeed: 'instant (<5s)',
      savingsUsd: Math.round(standardCardFee * 100) / 100,
      recommended: false,
      badge: 'Mobile Wallets',
      reason: 'Direct P2M mobile wallet transfer with receipt verification.',
    });

    // Sort by net savings descending
    return estimates.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return b.savingsUsd - a.savingsUsd;
    });
  }
}

export const paymentRouter = new PaymentRouterService();
