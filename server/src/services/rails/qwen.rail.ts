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

    // Call the original DashScope implementation
    const result = await aiPaymentVerifierService.verify(
      payload.screenshotBase64,
      payload.expectedAmountPkr,
      payload.expectedDestination
    );

    return {
      isValid: result.isValid,
      confidence: result.confidence,
      fields: {
        transferAmount: result.fields?.amount ?? null,
        recipientAccount: result.fields?.recipient ?? null,
        bankName: result.fields?.bank ?? null,
        currency: result.fields?.currency ?? null,
        transactionDate: result.fields?.date ?? null,
      },
      rawJson: result.raw
    };
  }
}

export const qwenScreenshotRail = new QwenScreenshotRail();
