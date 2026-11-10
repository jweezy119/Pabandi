import { 
  IPaymentConnector, 
  ConnectorPaymentRequest, 
  ConnectorPaymentResponse, 
  ConnectorStatusResponse, 
  ConnectorWebhookResult,
  ConnectorRefundResponse,
  PaymentRailId 
} from './types';
import { logger } from '../../../utils/logger';

export class StripeConnector implements IPaymentConnector {
  readonly railId: PaymentRailId = 'stripe';
  readonly name = 'Stripe & Square Card Gateway';
  readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AED'];
  readonly isShariaCompliant = false; // Conventional card debt/interest rail unless specifically filtered
  readonly defaultFeePercent = 2.9;
  readonly fixedFeeUsd = 0.30;
  readonly averageSpeed = 'standard (1-2 days)';

  async initiatePayment(request: ConnectorPaymentRequest): Promise<ConnectorPaymentResponse> {
    try {
      const amountUsd = request.currency.toUpperCase() === 'PKR'
        ? Math.round((request.amount / 280) * 100) / 100
        : request.amount;

      const connectorRef = `pi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const clientSecret = `${connectorRef}_secret_${Math.random().toString(36).substring(2, 12)}`;
      const estimatedFee = Math.round((amountUsd * (this.defaultFeePercent / 100) + this.fixedFeeUsd) * 100) / 100;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      return {
        success: true,
        connectorRef,
        railId: this.railId,
        status: 'PENDING',
        currency: 'USD',
        amount: amountUsd,
        clientSecret,
        paymentUrl: `https://pabandi.com/pay/${request.paymentId}?rail=card`,
        instructions: `Pay with Visa, Mastercard, American Express, Apple Pay, or Google Pay via secure 3D-Secure card elements.`,
        estimatedFee,
        settlementSpeed: this.averageSpeed,
        isShariaCompliant: this.isShariaCompliant,
        expiresAt,
        rawResponse: {
          clientSecret,
          paymentIntentId: connectorRef,
          captureMethod: 'manual_escrow',
        },
      };
    } catch (err: any) {
      logger.error('[StripeConnector] initiatePayment error:', err);
      throw new Error(`StripeConnector initiation failed: ${err.message}`);
    }
  }

  async checkStatus(connectorRef: string): Promise<ConnectorStatusResponse> {
    return {
      connectorRef,
      railId: this.railId,
      status: 'PENDING',
      amount: 100,
      currency: 'USD',
    };
  }

  async processWebhook(payload: any, headers?: Record<string, string>): Promise<ConnectorWebhookResult> {
    const eventType = payload?.type;
    const paymentIntent = payload?.data?.object;
    const paymentId = paymentIntent?.metadata?.paymentId;

    let newStatus = undefined;
    if (eventType === 'payment_intent.succeeded') newStatus = 'SUCCEEDED';
    else if (eventType === 'payment_intent.payment_failed') newStatus = 'FAILED';

    return {
      handled: true,
      paymentId,
      connectorRef: paymentIntent?.id,
      newStatus: newStatus as any,
      txHash: paymentIntent?.charges?.data?.[0]?.id,
    };
  }

  async refundPayment(connectorRef: string, amount?: number): Promise<ConnectorRefundResponse> {
    return {
      success: true,
      refundId: `re_${Date.now()}`,
      amount: amount || 0,
      currency: 'USD',
      status: 'SUCCEEDED',
    };
  }
}

