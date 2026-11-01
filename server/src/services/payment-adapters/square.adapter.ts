import { PaymentAdapter } from './types';
import crypto from 'crypto';

export class SquareAdapter implements PaymentAdapter {
  id = 'square';
  supportsEscrow = false;

  async authorize(amount: number, currency: string, metadata: any = {}) {
    return { success: true, authId: `sq_auth_${crypto.randomUUID()}` };
  }

  async capture(authId: string, amount?: number) {
    return { success: true, captureId: `sq_cap_${crypto.randomUUID()}` };
  }

  async refund(captureId: string, amount?: number) {
    return { success: true, refundId: `sq_ref_${crypto.randomUUID()}` };
  }

  async createAgentCheckout(protocol: 'acp' | 'x402' | 'ap2' | 'ucp', metadata: any = {}) {
    const amount = metadata.amount || 0;
    return { success: true, checkoutUrl: `https://checkout.square.site/merchant/placeholder/checkout?amount=${amount * 100}&currency=USD&reference=${metadata.reference || crypto.randomUUID()}` };
  }
}
