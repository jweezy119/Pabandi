import { PaymentAdapter } from './types';
import crypto from 'crypto';

export class SolanaAdapter implements PaymentAdapter {
  id = 'solana';
  supportsEscrow = true;

  async authorize(amount: number, currency: string, metadata: any = {}) {
    return { success: true, authId: `sol_auth_${crypto.randomUUID()}` };
  }

  async capture(authId: string, amount?: number) {
    return { success: true, captureId: `sol_cap_${crypto.randomUUID()}` };
  }

  async refund(captureId: string, amount?: number) {
    return { success: true, refundId: `sol_ref_${crypto.randomUUID()}` };
  }

  async createAgentCheckout(protocol: 'acp' | 'x402' | 'ap2' | 'ucp', metadata: any = {}) {
    if (protocol === 'x402') {
      return {
        success: true,
        challenge: {
          protocol: 'x402',
          amount: metadata.amount,
          recipient: process.env.SOLANA_MERCHANT_WALLET,
          asset: 'USDC',
          network: 'solana',
        },
      };
    }
    return { success: true, checkoutUrl: `solana:${process.env.SOLANA_MERCHANT_WALLET}?amount=${metadata.amount}&label=Pabandi` };
  }
}
