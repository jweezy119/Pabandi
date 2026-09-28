import { PaymentRail, InvoiceData } from './index';

export const squareRail: PaymentRail = {
  id: 'square',
  name: 'Square',
  getPaymentUrl: (target: string, invoice: InvoiceData) => {
    try {
      const url = new URL(target);
      url.searchParams.set('amount', invoice.amount.toString());
      url.searchParams.set('note', `Invoice ${invoice.number}`);
      return url.toString();
    } catch {
      return target;
    }
  },
  validateTarget: (target: string) => {
    return /^https:\/\/(square\.link|checkout\.square\.site)/i.test(target);
  }
};
