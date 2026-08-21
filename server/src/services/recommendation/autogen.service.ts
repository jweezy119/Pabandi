import { logger } from '../../utils/logger';

/**
 * autogen.service — turns live freelancer-demand intelligence into Pabandi project
 * templates with market-accurate quotes.
 *
 * Frugality / Invent & Simplify:
 *  - We DO NOT scrape Fiverr/Upwork live (ToS + paid Apify). Instead we ingest a curated
 *    SEED dataset (2026 demand surges + median rates) and let it be refreshed by a human
 *    or a later paid pipeline. The autogen logic is identical regardless of source.
 *  - Quote math is transparent: baseRate × complexity × urgency × hours. No black box.
 *  - Output is a ProjectSpec the recommendation engine consumes directly.
 */

export interface SkillDemandSeed {
  skill: string;
  category: string;
  demandGrowthPct: number; // YoY surge (e.g. 938 for Claude Code specialists)
  medianRateUsd: number; // hourly, from platform data
  velocity: number; // 0..1 normalized demand momentum (computed)
}

// Seed dataset — 2026 freelancer-demand intelligence (Fiverr/Upwork/Freelancer indices).
// Replace/extend via setSeedData() when a live pipeline is wired.
export const DEFAULT_SEED: SkillDemandSeed[] = [
  { skill: 'Claude Code / AI coding', category: 'Programming & Tech', demandGrowthPct: 938, medianRateUsd: 95, velocity: 1.0 },
  { skill: 'AI UGC video ads', category: 'Video & Animation', demandGrowthPct: 265, medianRateUsd: 55, velocity: 0.9 },
  { skill: 'YouTube automation', category: 'Video & Animation', demandGrowthPct: 239, medianRateUsd: 50, velocity: 0.88 },
  { skill: 'Faceless YouTube creator', category: 'Video & Animation', demandGrowthPct: 488, medianRateUsd: 48, velocity: 0.95 },
  { skill: 'AI automation (n8n/workflows)', category: 'Programming & Tech', demandGrowthPct: 136, medianRateUsd: 70, velocity: 0.7 },
  { skill: 'Prompt engineering + fine-tuning', category: 'Data & AI', demandGrowthPct: 312, medianRateUsd: 80, velocity: 0.85 },
  { skill: 'AI voice agents', category: 'Programming & Tech', demandGrowthPct: 49, medianRateUsd: 65, velocity: 0.55 },
  { skill: 'Generative AI modeling', category: 'Design', demandGrowthPct: 220, medianRateUsd: 60, velocity: 0.8 },
  { skill: 'Cybersecurity / pen testing', category: 'Security', demandGrowthPct: 40, medianRateUsd: 110, velocity: 0.5 },
  { skill: 'Senior UX/UI design', category: 'Design', demandGrowthPct: 35, medianRateUsd: 85, velocity: 0.5 },
  { skill: 'Data analysis (Python/pandas/SQL)', category: 'Data & AI', demandGrowthPct: 89, medianRateUsd: 70, velocity: 0.6 },
  { skill: 'Short-form video editing', category: 'Video & Animation', demandGrowthPct: 30, medianRateUsd: 55, velocity: 0.5 },
];

let SEED: SkillDemandSeed[] = [...DEFAULT_SEED];

export function setSeedData(data: SkillDemandSeed[]) {
  SEED = data;
  // recompute velocity normalization
  const maxG = Math.max(...SEED.map((s) => s.demandGrowthPct));
  SEED.forEach((s) => (s.velocity = Math.min(1, s.demandGrowthPct / maxG)));
}

export interface GeneratedProject extends ProjectSpecLite {
  estimatedBudgetUsd: number;
  estimatedHours: number;
  milestones: { name: string; pct: number }[];
  demandGrowthPct: number;
  confidenceNote: string;
}

interface ProjectSpecLite {
  title: string;
  description: string;
  requiredSkills: string[];
  budgetUsd: number;
  category: string;
}

const COMPLEXITY_MULT = [1.0, 1.4, 2.0, 2.5]; // simple..complex
const URGENCY_MULT = [1.0, 1.2, 1.5];

/**
 * Generate a project template for a given skill from the demand seed.
 * Quote = medianRate × complexity × urgency × hours, with a floor so micro-gigs still pay.
 */
export function generateProject(
  skill: string,
  opts: { complexity?: 0 | 1 | 2 | 3; urgency?: 0 | 1 | 2; hours?: number } = {}
): GeneratedProject | null {
  const seed = SEED.find((s) => s.skill.toLowerCase().includes(skill.toLowerCase()));
  if (!seed) return null;

  const complexity = opts.complexity ?? (seed.velocity > 0.8 ? 2 : 1);
  const urgency = opts.urgency ?? 0;
  const hours = opts.hours ?? (complexity >= 2 ? 40 : 12);

  const baseRate = seed.medianRateUsd;
  const estimatedBudgetUsd = Math.round(baseRate * COMPLEXITY_MULT[complexity] * URGENCY_MULT[urgency] * hours);

  const milestones = buildMilestones(estimatedBudgetUsd);

  return {
    title: `${seed.skill} Specialist — ${seed.category} Delivery`,
    description:
      `We need an expert in ${seed.skill} to deliver a production-ready ${seed.category.toLowerCase()} artifact. ` +
      `Scope aligned to current market demand (${seed.demandGrowthPct}% YoY growth). Deliverables, milestones, ` +
      `and PAB-staked AI agent assignment handled by Pabandi escrow.`,
    requiredSkills: [seed.skill, seed.category],
    budgetUsd: estimatedBudgetUsd,
    category: seed.category,
    estimatedBudgetUsd,
    estimatedHours: hours,
    milestones,
    demandGrowthPct: seed.demandGrowthPct,
    confidenceNote: `Quote derived from ${seed.skill} median $${baseRate}/hr × complexity ${COMPLEXITY_MULT[complexity]} × urgency ${URGENCY_MULT[urgency]} × ${hours}h.`,
  };
}

export function buildMilestones(totalUsd: number): { name: string; pct: number }[] {
  // 4-phase milestone split: kickoff 20%, alpha 30%, beta 30%, final 20%
  const split = [0.2, 0.3, 0.3, 0.2];
  const names = ['Kickoff & Spec', 'Alpha Delivery', 'Beta & Integration', 'Final Handoff'];
  return split.map((p, i) => ({ name: names[i], pct: Math.round(p * 100) }));
}

/** Top-N highest-velocity skills to auto-generate projects for. */
export function topDemandSkills(n = 8): SkillDemandSeed[] {
  return [...SEED].sort((a, b) => b.velocity - a.velocity).slice(0, n);
}

/**
 * Bulk-generate project specs for the hottest skills — feeds the autogen → post → bid loop.
 */
export function generatePipeline(n = 8): GeneratedProject[] {
  const out: GeneratedProject[] = [];
  for (const s of topDemandSkills(n)) {
    const p = generateProject(s.skill);
    if (p) out.push(p);
  }
  logger.info(`[autogen] generated ${out.length} project templates from demand seed`);
  return out;
}
