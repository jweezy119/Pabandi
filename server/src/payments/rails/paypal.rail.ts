import { PaymentRail, InvoiceData } from './index';

export const paypalRail: PaymentRail = {
  id: 'paypal',
  name: 'PayPal',
  getPaymentUrl: (target: string, invoice: InvoiceData) => {
    // target is like https://paypal.me/username
    const base = target.replace(/\/+$/, '');
    return `${base}/${invoice.amount}`;
  },
  validateTarget: (target: string) => {
    return /^https:\/\/(www\.)?paypal\.me\/[a-zA-Z0-9_]+(\/?.*)$/i.test(target);
  }
};
