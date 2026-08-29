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
    demandGrowthPct: number;
    medianRateUsd: number;
    velocity: number;
}
export declare const DEFAULT_SEED: SkillDemandSeed[];
export declare function setSeedData(data: SkillDemandSeed[]): void;
export interface GeneratedProject extends ProjectSpecLite {
    estimatedBudgetUsd: number;
    estimatedHours: number;
    milestones: {
        name: string;
        pct: number;
    }[];
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
/**
 * Generate a project template for a given skill from the demand seed.
 * Quote = medianRate × complexity × urgency × hours, with a floor so micro-gigs still pay.
 */
export declare function generateProject(skill: string, opts?: {
    complexity?: 0 | 1 | 2 | 3;
    urgency?: 0 | 1 | 2;
    hours?: number;
}): GeneratedProject | null;
export declare function buildMilestones(totalUsd: number): {
    name: string;
    pct: number;
}[];
/** Top-N highest-velocity skills to auto-generate projects for. */
export declare function topDemandSkills(n?: number): SkillDemandSeed[];
/**
 * Bulk-generate project specs for the hottest skills — feeds the autogen → post → bid loop.
 */
export declare function generatePipeline(n?: number): GeneratedProject[];
export {};
//# sourceMappingURL=autogen.service.d.ts.map