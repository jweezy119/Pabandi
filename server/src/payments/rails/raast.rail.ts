import { PaymentRail, InvoiceData } from './index';

const PAKISTAN_MOBILE_REGEX = /^((\+92|92)?(0)?3[0-9]{2}[-]?[0-9]{7})$/;
const PAKISTAN_IBAN_REGEX = /^PK[0-9]{2}[A-Z]{4}[0-9]{16}$/i;

export const raastRail: PaymentRail = {
  id: 'raast',
  name: 'Raast Instant Payment',
  getPaymentUrl: (target: string, invoice: InvoiceData) => {
    const cleanTarget = target.replace(/[^0-9A-Za-z]/g, '');
    const amount = invoice.currency.toUpperCase() === 'PKR' ? invoice.amount : Math.round(invoice.amount * 280);
    const ref = invoice.reference || invoice.number || 'PABANDI';
    return `raast:${cleanTarget}?amount=${amount}&ref=${encodeURIComponent(ref)}`;
  },
  validateTarget: (target: string) => {
    const clean = target.trim();
    return PAKISTAN_MOBILE_REGEX.test(clean) || PAKISTAN_IBAN_REGEX.test(clean);
  },
};

