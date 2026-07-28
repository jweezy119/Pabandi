import { logger } from '../utils/logger';

export type EscrowCheckoutEnvironment = 'sandbox' | 'production';

export const ESCROW_API_BASE = process.env.ESCROW_API_BASE || 'https://api.escrow.com';
export const ESCROW_ENV: EscrowCheckoutEnvironment = process.env.NODE_ENV === 'production'
  ? 'production'
  : 'sandbox';

const ESCROW_API_EMAIL = process.env.ESCROW_API_EMAIL || '';
const ESCROW_API_KEY = process.env.ESCROW_API_KEY || '';

export type EscrowCreateTransactionResponse = {
  id?: number | string;
  url?: string;
  status?: string;
};

export const escrowService = {
  async createTransaction({
    amount,
    currency,
    buyerEmail,
    sellerEmail,
    description,
    itemTitle,
    reference,
  }: {
    amount: number;
    currency: string;
    buyerEmail: string;
    sellerEmail: string;
    description: string;
    itemTitle: string;
    reference: string;
  }): Promise<EscrowCreateTransactionResponse> {
    if (!ESCROW_API_EMAIL || !ESCROW_API_KEY) {
      return { status: 'disabled' };
    }

    try {
      const baseUrl = `${ESCROW_API_BASE}/2017-09-01/transaction${ESCROW_ENV === 'sandbox' ? '-sandbox' : ''}`;
      const payload: any = {
        parties: [
          { role: 'buyer', customer: buyerEmail },
          { role: 'seller', customer: sellerEmail },
        ],
        currency,
        description,
        items: [
          {
            title: itemTitle,
            description,
            type: 'general_merchandise',
            quantity: 1,
            schedule: [
              {
                amount,
                payer_customer: buyerEmail,
                beneficiary_customer: sellerEmail,
              },
            ],
          },
        ],
        metadata: {
          pabandiReference: reference,
        },
      };

      logger.info('[Escrow] Creating transaction reference=%s amount=%s', reference, amount);

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;
      const id = Number(data?.id) || data?.id;
      const url = data?.url || `${ESCROW_API_BASE}/transaction/${id}`;

      return {
        id,
        url,
        status: response.ok ? 'awaiting_payment' : 'error',
      };
    } catch (error: any) {
      logger.error('[Escrow] createTransaction failed: %s', error?.message || error);
      return { status: 'error' };
    }
  },
};
