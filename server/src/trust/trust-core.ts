import { PrismaClient } from '@prisma/client';
import { emailService } from '../services/email.service';
import { writeAttestation } from '../services/onchain-attestation.service';

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

      const passportId = payload.passportId || payload.clientPassportId || '';

      // Persist to the audit table
      await prisma.invoiceTrustEvent.create({
        data: {
          invoiceId: finalInvoiceId,
          passportId,
          eventType,
        },
      });

      // Update the scoped score if applicable
      if (passportId) {
        await this.updateScopedScore(eventType, passportId);
      }

      // Fire-and-forget onchain attestation for key trust events
      const attestationEventTypes = new Set([
        'invoice.paid_on_time',
        'invoice.paid_late',
        'delivery.on_time',
        'delivery.missed',
        'booking.attended',
        'booking.no_show',
        'escrow.released',
        'escrow.disputed',
      ]);

      if (passportId && attestationEventTypes.has(eventType)) {
        const referenceId =
          payload.invoiceId || payload.jobId || payload.dealId || payload.bookingId || finalInvoiceId;

        writeAttestation({
          passportId,
          eventType,
          referenceId,
          metadata: { amount: payload.amount },
        }).then(async result => {
          if (result.signature) {
            try {
              await prisma.onchainAttestation.create({
                data: {
                  passportId,
                  eventType,
                  referenceId,
                  txSignature: result.signature,
                  hash: result.hash,
                  explorerUrl: result.explorerUrl,
                },
              });
            } catch (dbErr) {
              console.error('[TrustCore] attestation DB write failed:', dbErr);
            }
          }
        }).catch(err => {
          console.error('[TrustCore] attestation write failed:', err);
        });
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

    if (Math.abs(next - current) >= 20) {
      const client = await prisma.crmClient.findUnique({ where: { passportId } });
      if (client && client.email) {
        emailService.sendTrustScoreChanged(client, update.field, current, next);
      }
    }
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
