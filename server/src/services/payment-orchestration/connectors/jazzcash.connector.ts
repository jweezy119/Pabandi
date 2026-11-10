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

const DEFAULT_MERCHANT_WALLET = process.env.JAZZCASH_MERCHANT_WALLET || '03001234567';
const PKR_PER_USD = 280;

export class JazzCashConnector implements IPaymentConnector {
  readonly railId: PaymentRailId = 'jazzcash';
  readonly name = 'JazzCash & EasyPaisa Mobile Money';
  readonly supportedCurrencies = ['PKR', 'USD'];
  readonly isShariaCompliant = true; // Direct P2M mobile wallet transfer, 0% interest
  readonly defaultFeePercent = 1.0;
  readonly fixedFeeUsd = 0.0;
  readonly averageSpeed = 'instant (<5s)';

  async initiatePayment(request: ConnectorPaymentRequest): Promise<ConnectorPaymentResponse> {
    try {
      const recipientPhone = request.payee?.phone || request.payee?.raastId || DEFAULT_MERCHANT_WALLET;
      const amountPkr = request.currency.toUpperCase() === 'USD'
        ? Math.round(request.amount * PKR_PER_USD)
        : Math.round(request.amount);

      const connectorRef = `mwallet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const deeplink = `jazzcash://pay?merchantId=${recipientPhone}&amount=${amountPkr}&ref=${request.paymentId}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      return {
        success: true,
        connectorRef,
        railId: this.railId,
        status: 'PENDING',
        currency: 'PKR',
        amount: amountPkr,
        paymentUrl: `https://pabandi.com/pay/${request.paymentId}?rail=wallets`,
        qrData: deeplink,
        instructions: `Transfer Rs. ${amountPkr.toLocaleString()} to JazzCash / EasyPaisa wallet ${recipientPhone}. Confirm prompt in your mobile app.`,
        estimatedFee: Math.round(amountPkr * 0.01),
        settlementSpeed: this.averageSpeed,
        isShariaCompliant: this.isShariaCompliant,
        expiresAt,
        rawResponse: {
          merchantWallet: recipientPhone,
          channel: 'MWALLET_P2M',
          amountPkr,
        },
      };
    } catch (err: any) {
      logger.error('[JazzCashConnector] initiatePayment error:', err);
      throw new Error(`JazzCashConnector initiation failed: ${err.message}`);
    }
  }

  async checkStatus(connectorRef: string): Promise<ConnectorStatusResponse> {
    return {
      connectorRef,
      railId: this.railId,
      status: 'PENDING',
      amount: 28000,
      currency: 'PKR',
    };
  }

  async processWebhook(payload: any, headers?: Record<string, string>): Promise<ConnectorWebhookResult> {
    const paymentId = payload?.pp_BillReference || payload?.paymentId;
    const isSuccess = payload?.pp_ResponseCode === '000' || payload?.status === 'SUCCESS';
    const txnRef = payload?.pp_TxnRefNo || payload?.transactionId || `jc_${Date.now()}`;

    return {
      handled: true,
      paymentId,
      connectorRef: txnRef,
      newStatus: isSuccess ? 'SUCCEEDED' : 'FAILED',
      txHash: txnRef,
    };
  }

  async refundPayment(connectorRef: string, amount?: number): Promise<ConnectorRefundResponse> {
    return {
      success: true,
      refundId: `jc_refund_${Date.now()}`,
      amount: amount || 0,
      currency: 'PKR',
      status: 'SUCCEEDED',
    };
  }
}

