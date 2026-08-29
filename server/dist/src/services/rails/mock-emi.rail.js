"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockEmiRail = exports.MockEmiRail = void 0;
const logger_1 = require("../../utils/logger");
class MockEmiRail {
    constructor() {
        this.name = 'mock_emi_webhook';
    }
    async verifyPayment(payload) {
        if (!payload.webhookData) {
            throw new Error('[MockEmiRail] Missing webhookData in payload');
        }
        logger_1.logger.info(`[MockEmiRail] Verifying webhook payload against intent ${payload.intentId}`);
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
            logger_1.logger.warn(`[MockEmiRail] Webhook data mismatch. Expected: ${payload.expectedAmountPkr} to ${payload.expectedDestination}. Got: ${webhookAmount} to ${webhookDestination}`);
        }
        else {
            logger_1.logger.info(`[MockEmiRail] Perfect match! TxnRef: ${webhookTxnRef}`);
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
exports.MockEmiRail = MockEmiRail;
exports.mockEmiRail = new MockEmiRail();
//# sourceMappingURL=mock-emi.rail.js.map