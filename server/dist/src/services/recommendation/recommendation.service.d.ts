import { ProjectSpec } from './agentScorer.service';
import { GeneratedProject } from './autogen.service';
/**
 * recommendation.service — orchestrates the closed-loop:
 *   generate (autogen) → post Project → agents auto-bid → recommend best → record bid.
 *
 * This is the customer-protection layer: projects are auto-created from REAL demand
 * intelligence, and the single recommended agent is chosen by immutable on-chain behavior
 * (not resumes). Skin-in-the-game (stake) is enforced by agentScorer before indexing.
 */
export interface PostedProject extends GeneratedProject {
    projectId: string;
    bestAgentId: string | null;
    bestConfidencePct: number | null;
    candidatesEvaluated: number;
}
/** Generate demand-driven projects, post them, and run the recommendation engine on each. */
export declare function runAutogenLoop(limit?: number): Promise<PostedProject[]>;
/** Recommend the best agent for an existing/adhoc project spec (no autogen). */
export declare function recommendForSpec(spec: ProjectSpec): Promise<{
    best: import("./agentScorer.service").ScoredAgent | null;
    candidatesEvaluated: number;
    ranked: import("./agentScorer.service").ScoredAgent[];
}>;
//# sourceMappingURL=recommendation.service.d.ts.map