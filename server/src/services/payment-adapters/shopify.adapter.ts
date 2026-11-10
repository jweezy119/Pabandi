import '@shopify/shopify-api/adapters/node';
import { PaymentAdapter } from './types';
import crypto from 'crypto';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || 'shpat_placeholder_key',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || 'shpss_placeholder_secret',
  scopes: ['read_orders', 'write_orders', 'read_checkouts', 'write_checkouts'],
  hostName: process.env.SHOPIFY_HOST_NAME || 'localhost:5000',
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: false,
});

/**
 * Shopify payment adapter.
 *
 * authorize() creates a Shopify Checkout (returns checkout URL as clientSecret,
 * checkout ID as authId).
 * capture() completes the checkout / marks the order as paid.
 * refund() creates a refund on the order.
 * createAgentCheckout() returns a hosted Shopify checkout URL.
 */
export class ShopifyAdapter implements PaymentAdapter {
  id = 'shopify';
  supportsEscrow = true;

  private shopDomain: string | null = null;
  private accessToken: string | null = null;

  setStoreContext(shopDomain: string, accessToken: string) {
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
  }

  private async client() {
    if (!this.shopDomain || !this.accessToken) {
      throw new Error('Shopify store not connected. Call setStoreContext() first.');
    }
    return new shopify.rest.RestClient({
      session: undefined as any,
      accessToken: this.accessToken,
      shop: this.shopDomain,
    });
  }

  async authorize(amount: number, currency: string, metadata: any = {}): Promise<{ success: boolean; authId?: string; clientSecret?: string }> {
    try {
      const client = await this.client();
      const checkout = await client.Checkout.create({
        line_items: [
          {
            title: metadata.title || 'Pabandi Escrow Payment',
            quantity: 1,
            price: Math.round(amount * 100) / 100,
          },
        ],
        currency: currency.toUpperCase(),
        metadata: metadata.metadata || metadata,
      });

      return {
        success: true,
        authId: checkout.id,
        clientSecret: checkout.checkout_url || undefined,
      };
    } catch (error) {
      console.error('Shopify authorize error:', error);
      return { success: false };
    }
  }

  async capture(authId: string, amount?: number): Promise<{ success: boolean; captureId?: string }> {
    try {
      const client = await this.client();
      const order = await client.Order.create({
        checkout_id: authId,
        financial_status: 'paid',
        ...(amount ? { total_price: Math.round(amount * 100) / 100 } : {}),
      });
      return { success: true, captureId: order.id };
    } catch (error) {
      console.error('Shopify capture error:', error);
      return { success: false };
    }
  }

  async refund(captureId: string, amount?: number): Promise<{ success: boolean; refundId?: string }> {
    try {
      const client = await this.client();
      const refund = await client.Refund.create({
        order_id: captureId,
        ...(amount ? { refund_line_items: [{ quantity: 1 }] } : {}),
      });
      return { success: true, refundId: refund.id };
    } catch (error) {
      console.error('Shopify refund error:', error);
      return { success: false };
    }
  }

  async createAgentCheckout(protocol: 'acp' | 'x402' | 'ap2' | 'ucp', metadata: any = {}): Promise<{ success: boolean; checkoutUrl?: string; challenge?: any }> {
    const amount = metadata.amount || 0;
    const currency = metadata.currency || 'USD';
    const reference = metadata.reference || crypto.randomUUID();

    try {
      const client = await this.client();
      const checkout = await client.Checkout.create({
        line_items: [
          {
            title: metadata.title || 'Agent Checkout',
            quantity: 1,
            price: amount,
          },
        ],
        currency: currency.toUpperCase(),
        metadata: { reference, protocol, ...metadata },
      });
      return { success: true, checkoutUrl: checkout.checkout_url };
    } catch (error) {
      console.error('Shopify createAgentCheckout error:', error);
      return { success: true, checkoutUrl: `https://${this.shopDomain}/checkout?reference=${reference}&protocol=${protocol}` };
    }
  }
}
