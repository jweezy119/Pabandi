import { eventBus, TrustEvent } from './event-bus.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// ─── Reliability Score Calculator ────────────────────────────────────────────
//
// Re-exported rather than reimplemented. This file previously carried its own
// copy of the scoring maths, a third variant alongside `crm-reliability.service`
// and `reliability.service`; the three had drifted (different default penalties,
// different stage precedence), so a client's score depended on which code path
// happened to ask. There is now one implementation.
import {
  calculateClientScore,
  getClientStage,
  updateClientScore,
} from './crm-reliability.service';

export { calculateClientScore, getClientStage, updateClientScore };

// ─── Event Handlers ─────────────────────────────────────────────────────────

export function initializeTrustCore(): void {
  // These four events move a trust score. If the process dies between the
  // business write that produced them and the score update, the movement is
  // lost with no record — and an under-counted trust score is the one class of
  // platform bug that silently disadvantages a real person. They are therefore
  // written to the outbox before dispatch and replayed at boot.
  for (const type of [
    'score.changed',
    'escrow.funded',
    'escrow.released',
    'escrow.disputed',
    // Delivery outcomes move a PROVIDER's score. An event emitted and lost is a
    // real worker who turned up and got nothing, or one who no-showed and kept
    // their standing — the same silent-disadvantage class as above.
    'delivery.on_time',
    'delivery.late',
    'delivery.missed',
  ]) {
    eventBus.markDurable(type);
  }

  eventBus.markStarted();

  // score.changed → update CrmClient.reliabilityScore
  eventBus.subscribe('score.changed', async (event: TrustEvent) => {
    const clientId = event.clientId || event.data?.clientId;
    if (!clientId) return;

    try {
      const jobs = await prisma.crmJob.findMany({ where: { clientId } });
      const score = calculateClientScore(clientId, jobs);

      await prisma.crmClient.update({
        where: { id: clientId },
        data: { reliabilityScore: score },
      });

      logger.info(`[TrustCore] Updated client ${clientId} score → ${score}`);
    } catch (err: any) {
      logger.error(`[TrustCore] Score update failed for ${clientId}: ${err.message}`);
    }
  });

  // escrow.funded → update CrmJob.escrowStatus
  eventBus.subscribe('escrow.funded', async (event: TrustEvent) => {
    const jobId = event.jobId || event.data?.jobId;
    if (!jobId) return;

    try {
      await prisma.crmJob.update({
        where: { id: jobId },
        data: { escrowStatus: 'HELD' },
      });

      logger.info(`[TrustCore] Job ${jobId} escrow funded → HELD`);
    } catch (err: any) {
      logger.error(`[TrustCore] Escrow fund update failed for ${jobId}: ${err.message}`);
    }
  });

  // escrow.released → update CrmJob.escrowStatus + trigger score recalculation
  eventBus.subscribe('escrow.released', async (event: TrustEvent) => {
    const jobId = event.jobId || event.data?.jobId;
    const clientId = event.clientId || event.data?.clientId;
    if (!jobId) return;

    try {
      await prisma.crmJob.update({
        where: { id: jobId },
        data: { escrowStatus: 'RELEASED' },
      });

      // Recalculate score on release (positive signal)
      if (clientId) {
        eventBus.publish({
          type: 'score.changed',
          clientId,
          data: { trigger: 'escrow.released', jobId },
          timestamp: new Date(),
        });
      }

      logger.info(`[TrustCore] Job ${jobId} escrow released → RELEASED`);
    } catch (err: any) {
      logger.error(`[TrustCore] Escrow release update failed for ${jobId}: ${err.message}`);
    }
  });

  // escrow.disputed → flag client + update job status
  eventBus.subscribe('escrow.disputed', async (event: TrustEvent) => {
    const jobId = event.jobId || event.data?.jobId;
    const clientId = event.clientId || event.data?.clientId;
    if (!jobId) return;

    try {
      await prisma.crmJob.update({
        where: { id: jobId },
        data: { escrowStatus: 'DISPUTED' },
      });

      // Recalculate score (dispute is negative)
      if (clientId) {
        eventBus.publish({
          type: 'score.changed',
          clientId,
          data: { trigger: 'escrow.disputed', jobId },
          timestamp: new Date(),
        });
      }

      logger.info(`[TrustCore] Job ${jobId} escrow disputed`);
    } catch (err: any) {
      logger.error(`[TrustCore] Escrow dispute update failed for ${jobId}: ${err.message}`);
    }
  });

  // checkin.verified → mark job complete + update provider stats
  eventBus.subscribe('checkin.verified', async (event: TrustEvent) => {
    const jobId = event.jobId || event.data?.jobId;
    if (!jobId) return;

    try {
      await prisma.crmJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      logger.info(`[TrustCore] Job ${jobId} check-in verified → COMPLETED`);
    } catch (err: any) {
      logger.error(`[TrustCore] Checkin verify failed for ${jobId}: ${err.message}`);
    }
  });

  /**
   * Delivery outcomes → the WORKER's deliveryScore.
   *
   * These three events were emitted by jobLifecycle and crm.service and had no
   * subscriber, so a provider who completed every job on time and one who
   * no-showed repeatedly carried the same deliveryScore. Not a small gap: delivery
   * is the signal the whole reputation product is built on, and it was inert.
   *
   * The passport is read from the job, then from the assigned employee, because a
   * job may carry its own (an independent worker) or belong to staff (an employee
   * with a passport). Without either there is no one to score, and we log rather
   * than invent a subject — attributing a penalty to an arbitrary worker would be
   * worse than not scoring.
   */
  const applyDeliveryDelta = async (
    event: TrustEvent,
    eventType: 'delivery.on_time' | 'delivery.late' | 'delivery.missed',
  ) => {
    const jobId = event.jobId || event.data?.jobId;
    if (!jobId) return;

    const DELTA = { 'delivery.on_time': 10, 'delivery.late': -5, 'delivery.missed': -20 };

    try {
      const job = await prisma.crmJob.findFirst({
        where: { id: jobId },
        select: {
          passportId: true,
          employee: { select: { passportId: true } },
        },
      });
      if (!job) return;

      const passportId = job.passportId ?? job.employee?.passportId ?? null;
      if (!passportId) {
        logger.warn(
          `[TrustCore] ${eventType} for job ${jobId} had no worker passport; score not updated.`,
        );
        return;
      }

      const passport = await prisma.trustPassport.findUnique({
        where: { id: passportId },
        select: { deliveryScore: true },
      });
      if (!passport) return;

      // Clamped to the same 0–1000 band every other delta uses. Without the clamp
      // a long run of on-time jobs could exceed the scale the rest of the system
      // assumes.
      const next = Math.max(0, Math.min(1000, (passport.deliveryScore ?? 500) + DELTA[eventType]));
      const applied = next - (passport.deliveryScore ?? 500);

      await prisma.trustPassport.update({
        where: { id: passportId },
        data: { deliveryScore: next },
      });

      logger.info(`[TrustCore] ${eventType} job ${jobId} → deliveryScore ${applied >= 0 ? '+' : ''}${applied} (${next}).`);
    } catch (err: any) {
      logger.error(`[TrustCore] ${eventType} failed for job ${jobId}: ${err.message}`);
    }
  };

  eventBus.subscribe('delivery.on_time', (event: TrustEvent) => applyDeliveryDelta(event, 'delivery.on_time'));
  eventBus.subscribe('delivery.late', (event: TrustEvent) => applyDeliveryDelta(event, 'delivery.late'));
  eventBus.subscribe('delivery.missed', (event: TrustEvent) => applyDeliveryDelta(event, 'delivery.missed'));

  // passport.linked → enrich client with cross-module data
  eventBus.subscribe('passport.linked', async (event: TrustEvent) => {
    const clientId = event.clientId || event.data?.clientId;
    if (!clientId) return;

    try {
      logger.info(`[TrustCore] Passport linked for client ${clientId}`, event.data?.passportData);
    } catch (err: any) {
      logger.error(`[TrustCore] Passport link failed for ${clientId}: ${err.message}`);
    }
  });

  logger.info('[TrustCore] All event handlers initialized');
}
