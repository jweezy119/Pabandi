"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qwenScreenshotRail = exports.QwenScreenshotRail = void 0;
const ai_payment_verifier_service_1 = require("../ai.payment.verifier.service");
const logger_1 = require("../../utils/logger");
class QwenScreenshotRail {
    constructor() {
        this.name = 'qwen_screenshot_ocr';
    }
    async verifyPayment(payload) {
        if (!payload.screenshotBase64) {
            throw new Error('[QwenScreenshotRail] Missing screenshotBase64 in payload');
        }
        logger_1.logger.info(`[QwenScreenshotRail] Verifying intent ${payload.intentId} via DashScope`);
        // Call the original DashScope implementation
        const result = await ai_payment_verifier_service_1.aiPaymentVerifierService.verify(payload.screenshotBase64, payload.expectedAmountPkr, payload.expectedDestination);
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
exports.QwenScreenshotRail = QwenScreenshotRail;
exports.qwenScreenshotRail = new QwenScreenshotRail();
//# sourceMappingURL=qwen.rail.js.map