import { PaymentRailProvider, VerificationPayload, VerificationResult } from '../../interfaces/payment-rail.provider';
import { logger } from '../../utils/logger';

export class MockEmiRail implements PaymentRailProvider {
  name = 'mock_emi_webhook';

  async verifyPayment(payload: VerificationPayload): Promise<VerificationResult> {
    if (!payload.webhookData) {
      throw new Error('[MockEmiRail] Missing webhookData in payload');
    }

    logger.info(`[MockEmiRail] Verifying webhook payload against intent ${payload.intentId}`);

    const webhookAmount = payload.webhookData.amount;
    const webhookDestination = payload.webhookData.destinationAccount;
    const webhookTxnRef = payload.webhookData.transactionId; // The unique bank reference

    // Allow 1% tolerance for fees
    const amountMatches = webhookAmount !== undefined && webhookAmount >= payload.expectedAmountPkr * 0.99;
    
    // Simple substring match for destination account (e.g. IBAN or Raast ID)
    const destMatches = webhookDestination && payload.expectedDestination && 
      (webhookDestination.toLowerCase().includes(payload.expectedDestination.toLowerCase()) || 
       payload.expectedDestination.toLowerCase().includes(webhookDestination.toLowerCase()));

    const isValid = amountMatches && destMatches;

    if (!isValid) {
      logger.warn(`[MockEmiRail] Webhook data mismatch. Expected: ${payload.expectedAmountPkr} to ${payload.expectedDestination}. Got: ${webhookAmount} to ${webhookDestination}`);
    } else {
      logger.info(`[MockEmiRail] Perfect match! TxnRef: ${webhookTxnRef}`);
    }

    return {
      isValid,
      confidence: isValid ? 1.0 : 0.0,
      providerTxnRef: webhookTxnRef,
      fields: {
        transferAmount: webhookAmount || null,
        recipientAccount: webhookDestination || null,
        bankName: payload.webhookData.bankName || 'Mock EMI',
        currency: 'PKR',
        transactionDate: payload.webhookData.timestamp || new Date().toISOString()
      }
    };
  }
}

export const mockEmiRail = new MockEmiRail();
