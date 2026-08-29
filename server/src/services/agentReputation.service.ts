/**
 * agentReputation.service.ts — outcome-driven trust updates for agents.
 *
 * Subscribes to booking outcomes (COMPLETED / NO_SHOW / CANCELLED) and:
 *  - awards bonus PAB on completion (+5 trust)
 *  - slashes stake on no-show (-5 trust, -5 PAB)
 *  - minor penalty on cancel (-1 trust)
 *  - re-issues PTP attestation with updated trust band
 *  - emits TrustAuditTrail event
 */
import { prisma } from '../utils/database';
import { ptpEngine } from '../protocol/ptp.spec';
import { logger } from '../utils/logger';

export interface ReputationInput {
  agentId: string;
  outcome: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  bookingId?: string;
  gigId?: string;
  qualityScore?: number;
  metadata?: Record<string, any>;
}

async function getTrustScore(agentId: string): Promise<number> {
  const agent = await prisma.web3Agent.findUnique({ where: { id: agentId }, select: { balancePab: true } });
  if (!agent) return 50;
  return Math.max(0, Math.min(100, 50 + (agent.balancePab || 0) * 2));
}

async function recordAuditTrail(
  userId: string,
  previousScore: number,
  newScore: number,
  reason: string,
  severity: 'positive' | 'neutral' | 'negative',
  metadata?: Record<string, any>,
) {
  const currentHash = require('crypto')
    .createHash('sha256')
    .update(`${userId}:${previousScore}:${newScore}:${Date.now()}`)
    .digest('hex');
  await prisma.trustAuditTrail.create({
    data: {
      userId,
      previousScore,
      newScore,
      changeReason: reason,
      component: 'AGENT_REPUTATION',
      severity,
      weightUsed: 1,
      currentHash,
      metadata: metadata || {},
    } as any,
  });
}

export async function processReputation(input: ReputationInput): Promise<any> {
  const agent = await prisma.web3Agent.findUnique({ where: { id: input.agentId } });
  if (!agent) throw new Error(`agent not found: ${input.agentId}`);

  const prevScore = await getTrustScore(input.agentId);
  let stakeDelta = 0;
  let trustDelta = 0;
  let reason = '';
  let severity: 'positive' | 'neutral' | 'negative' = 'neutral';

  if (input.outcome === 'COMPLETED') {
    const bonus = +(input.qualityScore ? input.qualityScore * 0.2 : 2).toFixed(2);
    stakeDelta = bonus;
    trustDelta = 5;
    reason = `agent completed ${input.bookingId || input.gigId || 'booking'}`;
    severity = 'positive';

    await prisma.agentTransaction.create({
      data: {
        agentId: input.agentId,
        type: 'BONUS',
        amount: bonus,
        fromAddress: process.env.PABANDI_TREASURY_WALLET || 'TREASURY',
        toAddress: agent.walletAddress,
        txHash: `rep:${input.agentId}:${Date.now()}`,
        metadata: { ...input.metadata, outcome: input.outcome, bookingId: input.bookingId, gigId: input.gigId } as any,
      } as any,
    });
  } else if (input.outcome === 'NO_SHOW') {
    const stake = await prisma.agentStake.findUnique({ where: { agentId: input.agentId } });
    const slash = Math.min(stake?.amountPab || 0, 5);
    stakeDelta = -slash;
    trustDelta = -15;
    reason = `agent no-show ${input.bookingId || input.gigId || 'booking'}`;
    severity = 'negative';

    await prisma.agentTransaction.create({
      data: {
        agentId: input.agentId,
        type: 'SLASH',
        amount: -slash,
        fromAddress: agent.walletAddress,
        toAddress: process.env.PABANDI_TREASURY_WALLET || 'TREASURY',
        txHash: `slash:${input.agentId}:${Date.now()}`,
        metadata: { ...input.metadata, outcome: input.outcome, bookingId: input.bookingId, gigId: input.gigId } as any,
      } as any,
    });
  } else {
    trustDelta = -1;
    reason = `agent cancelled ${input.bookingId || input.gigId || 'booking'}`;
    severity = 'neutral';
  }

  if (stakeDelta !== 0) {
    const currentStake = await prisma.agentStake.findUnique({ where: { agentId: input.agentId } });
    const newAmount = (currentStake?.amountPab || 0) + stakeDelta;
    await prisma.agentStake.upsert({
      where: { agentId: input.agentId },
      create: { agentId: input.agentId, amountPab: Math.max(0, newAmount), vault: process.env.PABANDI_TREASURY_WALLET || 'TREASURY', indexed: newAmount >= 2000 },
      update: { amountPab: Math.max(0, newAmount), indexed: newAmount >= 2000 },
    });
  }

  const newScore = Math.max(0, Math.min(100, prevScore + trustDelta));
  await prisma.web3Agent.update({
    where: { id: input.agentId },
    data: { balancePab: { increment: Math.max(0, stakeDelta) } },
  });

  await recordAuditTrail(input.agentId, prevScore, newScore, reason, severity, {
    outcome: input.outcome,
    bookingId: input.bookingId,
    gigId: input.gigId,
    stakeDelta,
  });

  try {
    ptpEngine.issueAgentPassport({
      agentId: input.agentId,
      ownerUserId: input.agentId,
      capabilities: ['act:book', 'act:bid', 'act:deliver'],
      trustScore: newScore,
      velocity: {
        direction: trustDelta > 0 ? 'RISING' : trustDelta < 0 ? 'DECLINING' : 'STEADY',
        momentum: Math.abs(trustDelta) / 10,
        confidence: 0.8,
      },
    });
  } catch (e: any) {
    logger.warn(`[agentReputation] attestation re-issue failed: ${e.message}`);
  }

  return {
    ok: true,
    agentId: input.agentId,
    outcome: input.outcome,
    stakeDelta,
    trustDelta,
    prevScore,
    newScore,
  };
}

export const agentReputationService = {
  processReputation,
};
