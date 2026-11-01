import Stripe from 'stripe';
import { PaymentAdapter } from './types';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export class StripeAdapter implements PaymentAdapter {
  id = 'stripe';
  supportsEscrow = true;

  async authorize(amount: number, currency: string, metadata: any = {}) {
    try {
      const idempotencyKey = metadata.idempotencyKey || `auth_${crypto.randomUUID()}`;
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(amount * 100),
          currency: currency.toLowerCase(),
          capture_method: 'manual',
          metadata,
        },
        { idempotencyKey }
      );
      return { success: true, authId: paymentIntent.id, clientSecret: paymentIntent.client_secret || undefined };
    } catch (error) {
      console.error('Stripe authorize error:', error);
      return { success: false };
    }
  }

  async capture(authId: string, amount?: number) {
    try {
      const idempotencyKey = `capture_${crypto.randomUUID()}`;
      const captureOptions: any = {};
      if (amount) captureOptions.amount_to_capture = Math.round(amount * 100);
      const paymentIntent = await stripe.paymentIntents.capture(authId, captureOptions, { idempotencyKey });
      return { success: paymentIntent.status === 'succeeded', captureId: paymentIntent.id };
    } catch (error) {
      console.error('Stripe capture error:', error);
      return { success: false };
    }
  }

  async refund(captureId: string, amount?: number) {
    try {
      const idempotencyKey = `refund_${crypto.randomUUID()}`;
      const refundOptions: any = { payment_intent: captureId };
      if (amount) refundOptions.amount = Math.round(amount * 100);
      const refund = await stripe.refunds.create(refundOptions, { idempotencyKey });
      return { success: refund.status === 'succeeded', refundId: refund.id };
    } catch (error) {
      console.error('Stripe refund error:', error);
      return { success: false };
    }
  }

  async createAgentCheckout(protocol: 'acp' | 'x402' | 'ap2' | 'ucp', metadata: any = {}) {
    return { success: true, checkoutUrl: `https://checkout.stripe.com/c/pay/${crypto.randomUUID()}` };
  }
}
