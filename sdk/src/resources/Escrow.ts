import { AxiosInstance } from 'axios';

export interface EscrowCheckoutInput {
  sellerId: string;
  amount: number;
  currency?: string;
  buyerWallet?: string;
  reference?: string;
  channel?: 'SHOPIFY' | 'LIVE_SELLER' | 'FREELANCE' | 'HOSPITALITY' | 'UNIVERSAL';
  metadata?: Record<string, unknown>;
}

export interface EscrowCheckoutResult {
  success: boolean;
  checkoutAllowed?: boolean;
  score?: number;
  tier?: string;
  actionRequired?: string;
  checkoutUrl?: string;
  sessionId?: string;
}

export class EscrowResource {
  constructor(private client: AxiosInstance) {}

  async createCheckout(input: EscrowCheckoutInput): Promise<EscrowCheckoutResult> {
    const payload: Record<string, unknown> = {
      businessId: input.sellerId,
      amount: input.amount,
      successUrl: input.metadata?.successUrl as string || '',
      cancelUrl: input.metadata?.cancelUrl as string || '',
      source: input.channel || 'UNIVERSAL',
    };

    if (input.currency) payload.currency = input.currency;
    if (input.reference) payload.reference = input.reference;

    const response = await this.client.post('/checkout/embed-checkout', payload);
    return response.data as EscrowCheckoutResult;
  }

  async verifyBeforeCheckout(buyerWallet: string, requiredTier = 'Gold') {
    const response = await this.client.post('/passport/eligibility', {
      wallet_address: buyerWallet,
      required_tier: requiredTier,
    });
    return response.data;
  }
}
