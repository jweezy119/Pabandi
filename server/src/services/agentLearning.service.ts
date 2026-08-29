/**
 * agentLearning.service.ts — outcome-driven learning + iteration for agents.
 *
 * Design:
 *  - After every booking outcome (COMPLETED / NO_SHOW / CANCELLED) we record feedback
 *    when available and update a lightweight bandit over candidate behaviors.
 *  - Behaviors are variants like quote style, response template, pricing modifier.
 *  - Each agent keeps its own `AgentIteration` history; the best-performing variant
 *    is selected for the next cycle.
 *  - No external ML dep — pure Postgres + deterministic scoring so it works offline.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export interface IterationVariant {
  variant: string;
  metrics: {
    bookings: number;
    revenue: number;
    rating: number;
    completionRate: number;
    noShowRate: number;
  };
}

export interface LearningInput {
  agentId: string;
  outcome: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  revenue?: number;
  rating?: number;
  tags?: string[];
  bookingId?: string;
}

const DEFAULT_VARIANTS = [
  { variant: 'quote_standard', metrics: { bookings: 0, revenue: 0, rating: 0, completionRate: 0, noShowRate: 0 } },
  { variant: 'quote_value', metrics: { bookings: 0, revenue: 0, rating: 0, completionRate: 0, noShowRate: 0 } },
  { variant: 'quote_fast', metrics: { bookings: 0, revenue: 0, rating: 0, completionRate: 0, noShowRate: 0 } },
];

export async function recordLearningEvent(input: LearningInput): Promise<any> {
  const agent = await prisma.web3Agent.findUnique({ where: { id: input.agentId } });
  if (!agent) return { ok: false, message: 'agent not found' };

  // 1) Persist feedback if present
  if (input.rating && input.bookingId) {
    try {
      await prisma.agentFeedback.create({
        data: {
          bookingId: input.bookingId,
          agentId: input.agentId,
          rating: input.rating,
          comment: '',
          tags: input.tags || [],
        },
      });
    } catch { /* table may not exist yet */ }
  }

  // 2) Update all deployed variant metrics with this outcome (bandit update)
  let variants;
  try {
    variants = await prisma.agentIteration.findMany({ where: { agentId: input.agentId, deployed: true } });
  } catch {
    return { ok: true, message: 'learning tables not yet migrated', skipped: true };
  }
  const rows = variants.length > 0 ? variants : await ensureDefaultVariants(input.agentId);

  const updated = [];
  for (const v of rows) {
    const m = { ...(v.metrics as any) };
    m.bookings += 1;
    m.revenue += input.revenue || 0;
    m.rating = +(m.rating + input.rating).toFixed(2);
    m.completionRate = input.outcome === 'COMPLETED' ? m.completionRate + 1 : m.completionRate;
    m.noShowRate = input.outcome === 'NO_SHOW' ? m.noShowRate + 1 : m.noShowRate;

    const next = await prisma.agentIteration.update({ where: { id: v.id }, data: { metrics: m } });
    updated.push(next);
  }

  // 3) Pick best variant for next iteration
  const best = pickBestVariant(updated);

  // 4) Deploy best variant (single active variant per agent)
  await prisma.agentIteration.updateMany({ where: { agentId: input.agentId, deployed: true }, data: { deployed: false } });
  await prisma.agentIteration.update({ where: { id: best.id }, data: { deployed: true } });

  return {
    ok: true,
    agentId: input.agentId,
    outcome: input.outcome,
    bestVariant: best.variant,
    metrics: best.metrics,
  };
}

export async function getAgentLearningState(agentId: string): Promise<any> {
  const variants = await prisma.agentIteration.findMany({ where: { agentId } });
  const feedback = await prisma.agentFeedback.findMany({ where: { agentId }, orderBy: { createdAt: 'desc' }, take: 20 });
  const active = variants.find((v) => v.deployed);
  return {
    activeVariant: active?.variant || null,
    variants,
    feedback,
  };
}

async function ensureDefaultVariants(agentId: string) {
  const created = [];
  for (const def of DEFAULT_VARIANTS) {
    const v = await prisma.agentIteration.create({ data: { agentId, variant: def.variant, metrics: def.metrics, deployed: false } });
    created.push(v);
  }
  // Deploy first
  await prisma.agentIteration.update({ where: { id: created[0].id }, data: { deployed: true } });
  return created;
}

function scoreVariant(m: Record<string, any>): number {
  const bookings = m.bookings || 0;
  const rating = m.rating || 0;
  const completionRate = m.completionRate || 0;
  const noShowRate = m.noShowRate || 0;
  const revenue = m.revenue || 0;

  if (bookings === 0) return 0;

  const avgRating = rating / bookings;
  const completionRatio = bookings > 0 ? completionRate / bookings : 0;
  const noShowRatio = bookings > 0 ? noShowRate / bookings : 0;
  const revenuePerBooking = revenue / bookings;

  return +(avgRating * 25 + completionRatio * 35 - noShowRatio * 25 + Math.min(revenuePerBooking * 5, 10)).toFixed(2);
}

function pickBestVariant(variants: any[]): any {
  let best = variants[0];
  let bestScore = scoreVariant(best.metrics || {});
  for (let i = 1; i < variants.length; i++) {
    const s = scoreVariant(variants[i].metrics || {});
    if (s > bestScore) { bestScore = s; best = variants[i]; }
  }
  return best;
}

export const agentLearningService = { recordLearningEvent, getAgentLearningState };
