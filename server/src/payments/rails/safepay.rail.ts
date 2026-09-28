import { PaymentRail, InvoiceData } from './index';

export const safepayRail: PaymentRail = {
  id: 'safepay',
  name: 'SafePay',
  getPaymentUrl: (target: string, invoice: InvoiceData) => {
    try {
      const url = new URL(target);
      url.searchParams.set('amount', invoice.amount.toString());
      return url.toString();
    } catch {
      return target;
    }
  },
  validateTarget: (target: string) => {
    return /^https:\/\//i.test(target);
  }
};
