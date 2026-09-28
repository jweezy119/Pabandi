export interface InvoiceData {
  amount: number;
  number: string;
  currency: string;
}

export interface PaymentRail {
  id: string;
  name: string;
  getPaymentUrl: (target: string, invoice: InvoiceData) => string;
  validateTarget: (target: string) => boolean;
}

import { solanaRail } from './solana.rail';
import { squareRail } from './square.rail';
import { paypalRail } from './paypal.rail';
import { safepayRail } from './safepay.rail';
import { bankRail } from './bank.rail';

export const paymentRails: Record<string, PaymentRail> = {
  solana: solanaRail,
  square: squareRail,
  paypal: paypalRail,
  safepay: safepayRail,
  bank: bankRail,
};
