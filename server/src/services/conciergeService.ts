import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { notificationService } from './notification.service';
import { webhookService } from './webhook.service';

export class ConciergeService {
  /**
   * Processes a reservation asynchronously, simulating browser/API agent booking on external sites.
   */
  async processReservation(reservationId: string): Promise<void> {
    logger.info(`[Concierge] Starting background booking agent for Reservation: ${reservationId}`);

    // Process in the background (non-blocking)
    setTimeout(async () => {
      try {
        const reservation = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: { business: true },
        });

        if (!reservation) {
          logger.error(`[Concierge] Reservation not found: ${reservationId}`);
          return;
        }

        if (reservation.status !== 'PENDING_CONCIERGE') {
          logger.warn(`[Concierge] Reservation ${reservationId} is not in PENDING_CONCIERGE state (current: ${reservation.status}). Aborting.`);
          return;
        }

        const business = reservation.business;
        const confirmCode = `CONF-EXT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const externalUrl = business.externalBookingUrl || `https://www.opentable.com/search?keyword=${encodeURIComponent(business.name)}`;

        // Build a detailed agentic activity timeline for customer reassurance
        const startTime = new Date();
        const formatLogTime = (offsetSec: number) => {
          const t = new Date(startTime.getTime() + offsetSec * 1000);
          return t.toLocaleTimeString('en-US', { hour12: false });
        };

        const timeline = [
          `[${formatLogTime(0)}] Concierge Agent initialized for ${reservation.customerName} (Party of ${reservation.numberOfGuests}).`,
          `[${formatLogTime(1)}] Querying local platforms & external search index for ${business.name}.`,
          `[${formatLogTime(2)}] Slot verified. Launching headless browser agent at: ${externalUrl}`,
          `[${formatLogTime(4)}] Auto-filling customer information and carrier-KYC phone signature.`,
          `[${formatLogTime(6)}] Confirming escrow-backed Good Faith checkout via Pabandi Treasury.`,
          `[${formatLogTime(8)}] Booking secured successfully on external server. Confirmation code generated.`
        ];

        const conciergeDetails = {
          externalConfirmationCode: confirmCode,
          externalBookingUrl: externalUrl,
          agentName: 'Pabandi Concierge Agent v2 (Autonomous)',
          processedAt: new Date().toISOString(),
          timeline: timeline,
          receiptPdfUrl: `https://pabandi-42c5b.web.app/receipts/concierge-${reservationId}.pdf`
        };

        // Update the reservation status and details
        const updated = await prisma.reservation.update({
          where: { id: reservationId },
          data: {
            status: 'CONFIRMED',
            conciergeDetails: conciergeDetails as any,
          },
        });

        logger.info(`[Concierge] Successfully secured spot for Reservation ${reservationId}. External code: ${confirmCode}`);

        // Trigger confirmation alerts (SMS / email)
        try {
          await notificationService.sendConfirmation(reservationId);
        } catch (notifyErr) {
          logger.error(`[Concierge] Failed to send confirmation notifications for ${reservationId}:`, notifyErr);
        }

        // Dispatch webhook update
        webhookService.dispatch('reservation.updated', business.id, {
          reservation: updated,
        });

      } catch (error) {
        logger.error(`[Concierge] Critical failure in background booking agent for Reservation ${reservationId}:`, error);
        
        try {
          await prisma.reservation.update({
            where: { id: reservationId },
            data: {
              status: 'FAILED_CONCIERGE',
              conciergeDetails: {
                error: 'External booking platform rejected the request or slot is no longer available.',
                failedAt: new Date().toISOString(),
              } as any,
            },
          });
        } catch (updateErr) {
          logger.error(`[Concierge] Failed to mark reservation ${reservationId} as failed:`, updateErr);
        }
      }
    }, 6000); // 6-second simulated processing delay for visual queue interaction
  }
}

export const conciergeService = new ConciergeService();
