import { PaymentAdapter, PaymentContext } from './payment-adapters/types';
import { StripeAdapter } from './payment-adapters/stripe.adapter';
import { SquareAdapter } from './payment-adapters/square.adapter';
import { SolanaAdapter } from './payment-adapters/solana.adapter';
import { ShopifyAdapter } from './payment-adapters/shopify.adapter';

export class PaymentRouterService {
  private adapters: Map<string, PaymentAdapter> = new Map();

  constructor() {
    this.adapters.set('stripe', new StripeAdapter());
    this.adapters.set('square', new SquareAdapter());
    this.adapters.set('solana', new SolanaAdapter());
    this.adapters.set('shopify', new ShopifyAdapter());
  }

  selectAdapter(context: PaymentContext): PaymentAdapter {
    if (context.isAgent && context.currency === 'USDC') {
      return this.adapters.get('solana')!;
    }
    if (context.metadata?.source === 'shopify') {
      return this.adapters.get('shopify')!;
    }
    if (context.currency === 'USD' && context.clientCountry === 'US') {
      return this.adapters.get('stripe')!;
    }
    if (context.currency === 'USD') {
      return this.adapters.get('square')!;
    }
    return this.adapters.get('stripe')!;
  }

  getAdapter(id: string): PaymentAdapter | undefined {
    return this.adapters.get(id);
  }
}

export const paymentRouter = new PaymentRouterService();
