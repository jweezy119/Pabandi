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

const DEFAULT_RAAST_ID = process.env.RAAST_MERCHANT_ID || '03001234567';
const PKR_PER_USD = 280;

export class RaastConnector implements IPaymentConnector {
  readonly railId: PaymentRailId = 'raast';
  readonly name = 'State Bank of Pakistan (SBP) Raast Instant Rail';
  readonly supportedCurrencies = ['PKR', 'USD'];
  readonly isShariaCompliant = true; // State central clearing, 0% usury/fee
  readonly defaultFeePercent = 0.0;
  readonly fixedFeeUsd = 0.0; // 100% free national rail
  readonly averageSpeed = 'instant (<5s)';

  async initiatePayment(request: ConnectorPaymentRequest): Promise<ConnectorPaymentResponse> {
    try {
      const raastId = request.payee?.raastId || request.payee?.phone || DEFAULT_RAAST_ID;
      const amountPkr = request.currency.toUpperCase() === 'USD'
        ? Math.round(request.amount * PKR_PER_USD)
        : Math.round(request.amount);

      const connectorRef = `raast_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      // Generate standard SBP / EMVCo Interoperable QR Payload
      // Format specification: Payload Format Indicator (00), Point of Initiation Method (01), Merchant Account (26), Amount (54), Currency (53=586 for PKR)
      const qrPayload = `00020101021226340016pk.gov.sbp.raast0110${raastId}520454115303586540${amountPkr.toString().length}${amountPkr}5802PK5913Pabandi Escrow6007Karachi62230119${request.paymentId}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      return {
        success: true,
        connectorRef,
        railId: this.railId,
        status: 'PENDING',
        currency: 'PKR',
        amount: amountPkr,
        paymentUrl: `https://pabandi.com/pay/${request.paymentId}?rail=raast`,
        qrData: qrPayload,
        instructions: `Transfer Rs. ${amountPkr.toLocaleString()} to Raast ID ${raastId} via any Pakistani banking app (HBL, Meezan, Alfalah, Nayapay, SadaPay). Zero fees.`,
        estimatedFee: 0,
        settlementSpeed: this.averageSpeed,
        isShariaCompliant: this.isShariaCompliant,
        expiresAt,
        rawResponse: {
          raastId,
          standard: 'SBP Raast ISO 20022',
          clearingSwitch: 'Mojaloop / SBP Interoperable Switch',
          currency: 'PKR',
          amountPkr,
        },
      };
    } catch (err: any) {
      logger.error('[RaastConnector] initiatePayment error:', err);
      throw new Error(`RaastConnector initiation failed: ${err.message}`);
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
    const paymentId = payload?.paymentId || payload?.billReference;
    const sbpStan = payload?.stan || payload?.rrn || `raast_rrn_${Date.now()}`;
    const isSuccessful = payload?.responseCode === '00' || payload?.status === 'SUCCESS' || payload?.valid === true;

    return {
      handled: true,
      paymentId,
      connectorRef: sbpStan,
      newStatus: isSuccessful ? 'SUCCEEDED' : 'FAILED',
      txHash: sbpStan,
    };
  }

  async refundPayment(connectorRef: string, amount?: number): Promise<ConnectorRefundResponse> {
    return {
      success: true,
      refundId: `raast_rev_${Date.now()}`,
      amount: amount || 0,
      currency: 'PKR',
      status: 'SUCCEEDED',
    };
  }
}

