import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';
import { getWalletProfile, WalletProfile } from './walletProfile.adapter';

/**
 * agentScorer.service — Pabandi's "AI Recruiter": recommend the single best-fit agent
 * for a project from immutable on-chain behavior, not self-reported resumes.
 *
 * Honesty note (no fake ML): this is a DETERMINISTIC, WEIGHTED-RULE scorer. We do NOT
 * claim XGBoost/ensemble training — there is not yet enough labeled real-completion
 * data on mainnet to train one. The weights below are explicit and auditable, and the
 * output is a confidence % derived from real wallet signals. When real completion data
 * accumulates, this same interface can be swapped for a trained model with zero API change.
 *
 * Scoring dimensions (max 100):
 *   Warm-up / "OG" factor ........ +20  (wallet age > 6 months)
 *   Recurring income snapshot ..... +30  (proves consistent delivery / "salary")
 *   DeFi health / discipline ..... +10  (LTV < 50%); -20 if LTV > 80% (reckless)
 *   Skill match (semantic) ....... +50  (program interactions matching project skills)
 *   Reliability .................. -up to 25 (failed-tx ratio penalty)
 *   Stale ....................... -10 if inactive > 30d
 */

export interface ScoreBreakdown {
  warmUp: number;
  income: number;
  defiHealth: number;
  skillMatch: number;
  reliability: number;
  freshness: number;
  total: number; // 0..100
}

export interface ScoredAgent {
  agentId: string;
  walletAddress: string;
  category: string;
  profile: WalletProfile;
  breakdown: ScoreBreakdown;
  confidencePct: number; // total rounded to 1 decimal
}

export interface ProjectSpec {
  title: string;
  description: string;
  requiredSkills: string[]; // e.g. ['Rust','Anchor','DeFi']
  budgetUsd: number;
  category?: string;
}

const SIX_MONTHS_DAYS = 182;

function skillMatchScore(spec: ProjectSpec, profile: WalletProfile): number {
  // Map project skills to on-chain program-interaction signals.
  const skills = (spec.requiredSkills || []).map((s) => s.toLowerCase());
  let score = 0;
  const hasAnchor = skills.some((s) => ['anchor', 'rust', 'solana program', 'bpf', 'smart contract'].includes(s));
  if (hasAnchor && profile.anchorDeploys > 0) score += Math.min(50, profile.anchorDeploys * 12);
  const hasDefi = skills.some((s) => ['defi', 'lend', 'yield', 'treasury', 'kamino', 'solend'].includes(s));
  if (hasDefi && profile.defiInteractions > 0) score += Math.min(25, profile.defiInteractions * 5);
  // General activity still contributes a little for non-program skills (design, video, etc.)
  if (score === 0 && profile.txCount > 20) score = 10;
  return Math.min(50, score);
}

function scoreProfile(spec: ProjectSpec, profile: WalletProfile): ScoreBreakdown {
  const warmUp = profile.ageDays >= SIX_MONTHS_DAYS ? 20 : Math.round((profile.ageDays / SIX_MONTHS_DAYS) * 20);
  const income = profile.recurringIncome ? 30 : Math.round((Math.min(profile.incomeStreams, 2) / 2) * 30);

  let defiHealth = 0;
  if (profile.ltvPct === null) defiHealth = 5; // no leverage = neutral-good
  else if (profile.ltvPct < 50) defiHealth = 10;
  else if (profile.ltvPct > 80) defiHealth = -20;
  else defiHealth = 0;

  const skillMatch = skillMatchScore(spec, profile);

  const reliability = profile.failedTxRatio > 0 ? -Math.min(25, Math.round(profile.failedTxRatio * 100)) : 0;
  const freshness = profile.lastActiveDays > 30 ? -10 : 0;

  const total = Math.max(0, Math.min(100, warmUp + income + defiHealth + skillMatch + reliability + freshness));
  return { warmUp, income, defiHealth, skillMatch, reliability, freshness, total };
}

/**
 * Score a single agent against a project spec. Pulls fresh wallet profile (cached 10m
 * inside the adapter layer via caller if desired). Uses the agent's Pabandi stake to
 * gate: unstaked agents are not indexed (skin-in-the-game requirement).
 */
export async function scoreAgent(agentId: string, spec: ProjectSpec): Promise<ScoredAgent | null> {
  const agent = await prisma.web3Agent.findUnique({ where: { id: agentId } });
  if (!agent) return null;
  const stake = await prisma.agentStake.findUnique({ where: { agentId } });
  if (!stake || stake.amountPab < STAKE_REQUIRED_PAB) {
    // Not indexed — skin in the game not met. Return null so it never appears in ranking.
    return null;
  }
  const profile = await getWalletProfile(agent.walletAddress);
  const breakdown = scoreProfile(spec, profile);
  return {
    agentId,
    walletAddress: agent.walletAddress,
    category: agent.category,
    profile,
    breakdown,
    confidencePct: Math.round(breakdown.total * 10) / 10,
  };
}

/**
 * Recommend the single best-fit agent for a project. Scans all staked, active agents,
 * scores each, returns the top match with confidence + full breakdown for transparency.
 */
export async function recommendBestAgent(spec: ProjectSpec): Promise<{
  best: ScoredAgent | null;
  candidatesEvaluated: number;
  ranked: ScoredAgent[];
}> {
  const agents = await prisma.web3Agent.findMany({ where: { isActive: true } });
  const ranked: ScoredAgent[] = [];
  for (const a of agents) {
    try {
      const s = await scoreAgent(a.id, spec);
      if (s) ranked.push(s);
    } catch (e) {
      logger.warn(`[agentScorer] score failed for ${a.id}: ${(e as Error).message}`);
    }
  }
  ranked.sort((x, y) => y.breakdown.total - x.breakdown.total);
  return { best: ranked[0] || null, candidatesEvaluated: ranked.length, ranked: ranked.slice(0, 5) };
}

export const STAKE_REQUIRED_PAB = 2000;
