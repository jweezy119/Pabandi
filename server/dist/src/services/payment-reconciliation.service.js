"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentReconciliationService = void 0;
const database_1 = require("../utils/database");
const safepay_service_1 = require("./safepay.service");
const logger_1 = require("../utils/logger");
exports.paymentReconciliationService = {
    async reconcileStalePayments(options = {}) {
        const maxAgeMs = options.maxAgeMs ?? 30 * 60 * 1000; // 30 minutes
        const cutoff = new Date(Date.now() - maxAgeMs);
        const limit = options.limit ?? 50;
        const stalePayments = await database_1.prisma.payment.findMany({
            where: {
                status: { in: ['PENDING', 'PROCESSING'] },
                updatedAt: { lt: cutoff },
            },
            orderBy: { updatedAt: 'asc' },
            take: limit,
        });
        const results = [];
        for (const payment of stalePayments) {
            if (!payment.gatewayResponse)
                continue;
            try {
                const result = await exports.paymentReconciliationService.reconcilePayment(payment.id);
                results.push(result);
            }
            catch (error) {
                logger_1.logger.error(`Reconciliation failed for payment ${payment.id}: ${error}`);
                results.push({
                    paymentId: payment.id,
                    status: payment.status,
                    updated: false,
                    message: `reconciliation_error: ${error.message}`,
                });
            }
        }
        return results;
    },
    async reconcilePayment(paymentId) {
        const payment = await database_1.prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) {
            throw new Error(`Payment not found: ${paymentId}`);
        }
        const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'];
        if (terminalStatuses.includes(payment.status)) {
            return {
                paymentId,
                status: payment.status,
                updated: false,
                message: 'already_terminal',
            };
        }
        const gatewayResponse = payment.gatewayResponse || {};
        const reference = payment.paymentMethod === 'safepay'
            ? gatewayResponse.safepayReference || payment.id
            : payment.id;
        const result = await safepay_service_1.safepayService.getOrderStatus(reference);
        if (!result.found) {
            return {
                paymentId,
                status: payment.status,
                updated: false,
                remoteStatus: result.remoteStatus,
                message: 'not_found_on_gateway',
            };
        }
        const mappedStatus = mapRemoteStatus(result.remoteStatus);
        const isTerminal = terminalStatuses.includes(mappedStatus);
        const updates = {
            gatewayResponse: {
                ...gatewayResponse,
                safepayReconciliation: {
                    status: result.remoteStatus,
                    checkedAt: new Date().toISOString(),
                },
            },
        };
        if (isTerminal) {
            updates.status = mappedStatus;
            if (result.transactionId)
                updates.transactionId = result.transactionId;
        }
        const updated = await database_1.prisma.payment.update({
            where: { id: payment.id },
            data: updates,
        });
        if (mappedStatus === 'COMPLETED' && payment.status !== 'COMPLETED') {
            const fee = +(updated.amount * 0.03).toFixed(2);
            await database_1.prisma.payment.update({
                where: { id: updated.id },
                data: { platformFeeAmount: fee, platformFeeStatus: 'CAPTURED' },
            });
            if (updated.reservationId) {
                await database_1.prisma.reservation.update({
                    where: { id: updated.reservationId },
                    data: { depositPaid: true },
                });
            }
        }
        return {
            paymentId,
            status: updated.status,
            updated: true,
            remoteStatus: result.remoteStatus,
        };
    },
};
function mapRemoteStatus(remoteStatus) {
    const normalized = String(remoteStatus || '').toLowerCase();
    if (normalized.includes('complete') || normalized.includes('paid') || normalized.includes('success'))
        return 'COMPLETED';
    if (normalized.includes('cancel') || normalized.includes('cancelled'))
        return 'CANCELLED';
    if (normalized.includes('fail') || normalized.includes('decline') || normalized.includes('error'))
        return 'FAILED';
    if (normalized.includes('refund'))
        return 'REFUNDED';
    if (normalized.includes('process') || normalized.includes('pending'))
        return 'PROCESSING';
    return 'PENDING';
}
//# sourceMappingURL=payment-reconciliation.service.js.map