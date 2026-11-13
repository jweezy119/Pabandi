import { PaymentRailProvider, VerificationPayload, VerificationResult } from '../../interfaces/payment-rail.provider';
import { aiPaymentVerifierService } from '../ai.payment.verifier.service';
import { logger } from '../../utils/logger';

export class QwenScreenshotRail implements PaymentRailProvider {
  name = 'qwen_screenshot_ocr';

  async verifyPayment(payload: VerificationPayload): Promise<VerificationResult> {
    if (!payload.screenshotBase64) {
      throw new Error('[QwenScreenshotRail] Missing screenshotBase64 in payload');
    }

    logger.info(`[QwenScreenshotRail] Verifying intent ${payload.intentId} via DashScope`);

    // Call the hardened AI receipt verifier
    const result = await aiPaymentVerifierService.verify(
      payload.screenshotBase64,
      payload.expectedAmountPkr,
      payload.expectedDestination,
      { intentId: payload.intentId }
    );

    return {
      isValid: result.isValid,
      confidence: result.confidence,
      providerTxnRef: result.fields?.transactionRef,
      fields: {
        transferAmount: result.fields?.amount ?? null,
        recipientAccount: result.fields?.receiverId ?? result.fields?.recipient ?? null,
        bankName: result.fields?.bank ?? null,
        currency: result.fields?.currency ?? null,
        transactionDate: result.fields?.timestamp ?? result.fields?.date ?? null,
        transactionRef: result.fields?.transactionRef ?? null,
      },
      rawJson: result.raw
    };
  }
}

export const qwenScreenshotRail = new QwenScreenshotRail();
