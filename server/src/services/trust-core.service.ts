import { eventBus, TrustEvent } from './event-bus.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// ─── Reliability Score Calculator ────────────────────────────────────────────

export function calculateClientScore(jobs: any[]): number {
  let score = 50;
  const completed = jobs.filter(j => j.status === 'COMPLETED');
  const cancelled = jobs.filter(j => j.status === 'CANCELLED');
  const total = jobs.length;

  if (total === 0) return score;

  // Completion rate: +30 max
  score += (completed.length / total) * 30;

  // Cancel penalty: -15 max
  score -= (cancelled.length / total) * 15;

  // Repeat bonus: +5 for 3+ jobs, +10 for 10+
  if (total >= 10) score += 10;
  else if (total >= 3) score += 5;

  // Default penalty: -20 per refunded escrow
  const defaults = jobs.filter(j => j.escrowStatus === 'REFUNDED' || j.escrowStatus === 'DISPUTED').length;
  score -= defaults * 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Client Lifecycle Stage ─────────────────────────────────────────────────

export function getClientStage(client: any, jobs: any[]): string {
  const completed = jobs.filter((j: any) => j.status === 'COMPLETED');
  const hasDefaults = jobs.some((j: any) => j.escrowStatus === 'REFUNDED' || j.escrowStatus === 'DISPUTED');

  if (jobs.length === 0) return 'lead';
  if (client.phone || client.phoneVerified) return 'verified';
  if (completed.length >= 10 && (client.reliabilityScore || 50) > 80) return 'vip';
  if (hasDefaults || (client.reliabilityScore || 50) < 30) return 'at_risk';
  if (completed.length >= 2) return 'repeat';
  if (jobs.length >= 1) return 'booked';
  return 'lead';
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

export function initializeTrustCore(): void {
  // score.changed → update CrmClient.reliabilityScore
  eventBus.subscribe('score.changed', async (event: TrustEvent) => {
    const clientId = event.clientId || event.data?.clientId;
    if (!clientId) return;

    try {
      const jobs = await prisma.crmJob.findMany({ where: { clientId } });
      const score = calculateClientScore(jobs);

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
