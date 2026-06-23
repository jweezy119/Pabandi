import { safepayService } from './safepay.service';
import { paypalService } from './paypal.service';
import { logger } from '../utils/logger';

/**
 * Dual-market Payment Router
 *
 * Routes payment to the correct gateway based on the business currency:
 *   PKR → Safepay  (Local market)
 *   USD / other → PayPal  (USA / global market)
 *
 * This keeps both markets live simultaneously with zero code changes
 * in the reservation controller — just call paymentRouter.createCheckoutUrl().
 */
export const paymentRouter = {
  /**
   * Create a checkout URL routed to the right gateway.
   * @param amount       Deposit amount in the business's native currency units
   * @param currency     Business currency code e.g. "PKR" or "USD"
   * @param reservationId  Reservation ID for tracking
   */
  async createCheckoutUrl(
    amount: number,
    currency: string,
    reservationId: string
  ): Promise<{ url: string; gateway: 'safepay' | 'paypal' }> {
    const curr = currency.toUpperCase();

    if (curr === 'PKR') {
      // Local market → Safepay (amount is already in PKR)
      logger.info(`[PaymentRouter] Routing PKR ${amount} → Safepay (Local)`);
      const url = await safepayService.createCheckoutUrl(amount, reservationId);
      return { url, gateway: 'safepay' };
    } else {
      // USA / Global market → PayPal (convert amount to cents for consistency)
      // Amounts stored in DB are in major units (e.g. 10.00 USD), convert to cents
      const amountCents = Math.round(amount * 100);
      logger.info(`[PaymentRouter] Routing ${curr} ${amount} → PayPal (USA/Global)`);
      const url = await paypalService.createCheckoutUrl(amountCents, curr, reservationId);
      return { url, gateway: 'paypal' };
    }
  },

  /**
   * Issue a refund through the correct gateway.
   * @param currency       Business currency (determines which gateway)
   * @param gatewayRef     Safepay: reservationId | PayPal: captureId
   * @param amount         Amount to refund in major currency units
   */
  async refundDeposit(
    currency: string,
    gatewayRef: string,
    amount: number
  ): Promise<boolean> {
    const curr = currency.toUpperCase();

    if (curr === 'PKR') {
      return safepayService.refundDeposit(gatewayRef, amount);
    } else {
      const amountCents = Math.round(amount * 100);
      return paypalService.refundDeposit(gatewayRef, amountCents);
    }
  },

  /**
   * Returns which gateway handles a given currency.
   */
  gatewayFor(currency: string): 'safepay' | 'paypal' {
    return currency.toUpperCase() === 'PKR' ? 'safepay' : 'paypal';
  },
};
