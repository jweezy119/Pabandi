import { WalletProfile } from './walletProfile.adapter';
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
    firstParty: number;
    total: number;
}
export interface ScoredAgent {
    agentId: string;
    walletAddress: string;
    category: string;
    profile: WalletProfile;
    breakdown: ScoreBreakdown;
    confidencePct: number;
}
export interface ProjectSpec {
    title: string;
    description: string;
    requiredSkills: string[];
    budgetUsd: number;
    category?: string;
}
/**
 * Score a single agent against a project spec. Pulls fresh wallet profile (cached 10m
 * inside the adapter layer via caller if desired). Uses the agent's Pabandi stake to
 * gate: unstaked agents are not indexed (skin-in-the-game requirement).
 */
export declare function scoreAgent(agentId: string, spec: ProjectSpec): Promise<ScoredAgent | null>;
/**
 * Recommend the single best-fit agent for a project. Scans all staked, active agents,
 * scores each, returns the top match with confidence + full breakdown for transparency.
 */
export declare function recommendBestAgent(spec: ProjectSpec): Promise<{
    best: ScoredAgent | null;
    candidatesEvaluated: number;
    ranked: ScoredAgent[];
}>;
export declare const STAKE_REQUIRED_PAB = 2000;
//# sourceMappingURL=agentScorer.service.d.ts.map