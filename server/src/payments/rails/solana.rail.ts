import { PaymentRail, InvoiceData } from './index';

export const solanaRail: PaymentRail = {
  id: 'solana',
  name: 'Solana USDC',
  getPaymentUrl: (target: string, invoice: InvoiceData) => {
    // Basic SPL transfer link
    return `solana:${target}?amount=${invoice.amount}&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`;
  },
  validateTarget: (target: string) => {
    // Basic check for base58 string length 32-44
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(target);
  }
};
