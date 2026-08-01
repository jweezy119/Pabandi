import { prisma } from '../utils/database';
import { safepayService } from './safepay.service';
import { logger } from '../utils/logger';

export interface ReconciliationResult {
  paymentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  updated: boolean;
  remoteStatus?: string;
  message?: string;
}

export interface ReconciliationOptions {
  maxAgeMs?: number;
  limit?: number;
}

export const paymentReconciliationService = {
  async reconcileStalePayments(options: ReconciliationOptions = {}): Promise<ReconciliationResult[]> {
    const maxAgeMs = options.maxAgeMs ?? 30 * 60 * 1000; // 30 minutes
    const cutoff = new Date(Date.now() - maxAgeMs);
    const limit = options.limit ?? 50;

    const stalePayments = await prisma.payment.findMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    const results: ReconciliationResult[] = [];
    for (const payment of stalePayments) {
      if (!payment.gatewayResponse) continue;
      try {
        const result = await paymentReconciliationService.reconcilePayment(payment.id);
        results.push(result);
      } catch (error) {
        logger.error(`Reconciliation failed for payment ${payment.id}: ${error}`);
        results.push({
          paymentId: payment.id,
          status: payment.status,
          updated: false,
          message: `reconciliation_error: ${(error as Error).message}`,
        });
      }
    }

    return results;
  },

  async reconcilePayment(paymentId: string): Promise<ReconciliationResult> {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'] as const;
    if (terminalStatuses.includes(payment.status as any)) {
      return {
        paymentId,
        status: payment.status as any,
        updated: false,
        message: 'already_terminal',
      };
    }

    const gatewayResponse = (payment.gatewayResponse as Record<string, any>) || {};
    const reference = payment.paymentMethod === 'safepay'
      ? gatewayResponse.safepayReference || payment.id
      : payment.id;

    const result = await safepayService.getOrderStatus(reference);

    if (!result.found) {
      return {
        paymentId,
        status: payment.status as any,
        updated: false,
        remoteStatus: result.remoteStatus,
        message: 'not_found_on_gateway',
      };
    }

    const mappedStatus = mapRemoteStatus(result.remoteStatus);
    const isTerminal = terminalStatuses.includes(mappedStatus as any);

    const updates: any = {
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
      if (result.transactionId) updates.transactionId = result.transactionId;
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: updates,
    });

    if (mappedStatus === 'COMPLETED' && payment.status !== 'COMPLETED') {
      const fee = +(updated.amount * 0.03).toFixed(2);
      await prisma.payment.update({
        where: { id: updated.id },
        data: { platformFeeAmount: fee, platformFeeStatus: 'CAPTURED' },
      });

      if (updated.reservationId) {
        await prisma.reservation.update({
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

function mapRemoteStatus(remoteStatus?: string): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' {
  const normalized = String(remoteStatus || '').toLowerCase();
  if (normalized.includes('complete') || normalized.includes('paid') || normalized.includes('success')) return 'COMPLETED';
  if (normalized.includes('cancel') || normalized.includes('cancelled')) return 'CANCELLED';
  if (normalized.includes('fail') || normalized.includes('decline') || normalized.includes('error')) return 'FAILED';
  if (normalized.includes('refund')) return 'REFUNDED';
  if (normalized.includes('process') || normalized.includes('pending')) return 'PROCESSING';
  return 'PENDING';
}
