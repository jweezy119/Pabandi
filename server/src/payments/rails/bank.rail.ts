import { PaymentRail, InvoiceData } from './index';

export const bankRail: PaymentRail = {
  id: 'bank',
  name: 'Bank Transfer',
  getPaymentUrl: (target: string, _invoice: InvoiceData) => {
    // There is no URL for a bank transfer. 
    // The target contains the bank details to be displayed to the user.
    return '';
  },
  validateTarget: (target: string) => {
    return target.trim().length > 10;
  }
};
