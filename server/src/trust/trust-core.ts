import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type TrustEventPayload = {
  passportId?: string;
  invoiceId?: string;
  dealId?: string;
  jobId?: string;
  amount?: number;
  minutesLate?: number;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  clientId?: string;
  taskId?: string;
  clientPassportId?: string;
  [key: string]: any;
};

class TrustCore {
  async emit(eventType: string, payload: TrustEventPayload): Promise<void> {
    try {
      let finalInvoiceId = payload.invoiceId;
      if (!finalInvoiceId) {
        const fallback = await prisma.invoice.findFirst();
        finalInvoiceId = fallback?.id || '';
      }

      // Persist to the audit table
      await prisma.invoiceTrustEvent.create({
        data: {
          invoiceId: finalInvoiceId,
          passportId: payload.passportId || payload.clientPassportId || '',
          eventType,
        },
      });

      // Update the scoped score if applicable
      if (payload.passportId) {
        await this.updateScopedScore(eventType, payload.passportId);
      }
    } catch (err) {
      console.error(`[TrustCore] emit failed for ${eventType}:`, err);
      throw err;
    }
  }

  private async updateScopedScore(eventType: string, passportId: string): Promise<void> {
    const deltaMap: Record<string, { field: string; delta: number }> = {
      'invoice.paid_on_time': { field: 'paymentScore', delta: +10 },
      'invoice.paid_late': { field: 'paymentScore', delta: -5 },
      'invoice.overdue': { field: 'paymentScore', delta: -15 },
      'delivery.on_time': { field: 'deliveryScore', delta: +10 },
      'delivery.late': { field: 'deliveryScore', delta: -5 },
      'delivery.missed': { field: 'deliveryScore', delta: -20 },
      'booking.no_show': { field: 'showUpScore', delta: -20 },
      'delivery.checked_in': { field: 'showUpScore', delta: +5 },
    };

    const update = deltaMap[eventType];
    if (!update) return;

    const passport = await prisma.trustPassport.findUnique({
      where: { id: passportId },
    });
    if (!passport) return;

    const current = (passport as any)[update.field] ?? 500;
    const next = Math.max(0, Math.min(1000, current + update.delta));

    await prisma.trustPassport.update({
      where: { id: passportId },
      data: { [update.field]: next },
    });
  }

  async calculateScore(wallet: string): Promise<number> {
    return 500;
  }

  async getPassport(passportId: string): Promise<any> {
    const passport = await prisma.trustPassport.findUnique({
      where: { id: passportId }
    });
    return passport;
  }
}

export const trustCore = new TrustCore();
export default trustCore;
