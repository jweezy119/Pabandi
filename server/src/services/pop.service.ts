import { PrismaClient } from '@prisma/client';

export type PopEventType = 'INTENT' | 'ARRIVED' | 'NO_SHOW' | 'MERCHANT_START' | 'MERCHANT_FULFILL';

export interface PopEventInput {
  userId: string;
  businessId?: string;
  reservationId?: string;
  eventType: PopEventType;
  source: 'buyer' | 'merchant' | 'system';
  meta?: Record<string, any>;
}

export interface PopDisputePackage {
  reservationId?: string;
  buyerIntentAt?: string;
  merchantStartAt?: string;
  merchantFulfillAt?: string;
  noShowAt?: string;
  evidence: Record<string, any>;
}

const prisma = new PrismaClient();

export class PopService {
  private events: PopEventInput[] = [];

  async recordEvent(input: PopEventInput) {
    const createdAt = new Date().toISOString();
    const stored: PopEventInput & { createdAt: string } = { ...input, createdAt };
    this.events.push(stored);

    if (input.eventType === 'NO_SHOW' && input.reservationId) {
      await this.attachDisputePackage(input.reservationId, stored);
    }

    return stored;
  }

  async getEventsForReservation(reservationId: string) {
    return this.events
      .filter(e => e.reservationId === reservationId)
      .sort((a, b) => (a as any).createdAt.localeCompare((b as any).createdAt as any));
  }

  private async attachDisputePackage(reservationId: string, trigger: PopEventInput & { createdAt: string }) {
    const mapped = this.events
      .filter(e => e.reservationId === reservationId)
      .reduce((acc: Record<string, string>, ev) => {
        acc[ev.eventType + '_AT'] = (ev as any).createdAt;
        return acc;
      }, {});

    const pkg: PopDisputePackage = {
      reservationId,
      buyerIntentAt: mapped['INTENT_AT'] || undefined,
      merchantStartAt: mapped['MERCHANT_START_AT'] || undefined,
      merchantFulfillAt: mapped['MERCHANT_FULFILL_AT'] || undefined,
      noShowAt: mapped['NO_SHOW_AT'] || undefined,
      evidence: mapped,
    };

    await prisma.popEvidencePackage.create({
      data: {
        reservationId,
        evidence: pkg.evidence,
        buyerIntentAt: pkg.buyerIntentAt ? new Date(pkg.buyerIntentAt) : null,
        merchantStartAt: pkg.merchantStartAt ? new Date(pkg.merchantStartAt) : null,
        merchantFulfillAt: pkg.merchantFulfillAt ? new Date(pkg.merchantFulfillAt) : null,
        noShowAt: pkg.noShowAt ? new Date(pkg.noShowAt) : null,
      },
    });

    return pkg;
  }
}

export const popService = new PopService();
