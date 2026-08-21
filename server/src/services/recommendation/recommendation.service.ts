import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';
import { recommendBestAgent, ProjectSpec } from './agentScorer.service';
import { generatePipeline, GeneratedProject } from './autogen.service';

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
export async function runAutogenLoop(limit = 8): Promise<PostedProject[]> {
  const specs = generatePipeline(limit);
  const out: PostedProject[] = [];

  for (const spec of specs) {
    const project = await prisma.project.create({
      data: {
        title: spec.title,
        description: spec.description,
        category: spec.category,
        requiredSkills: spec.requiredSkills,
        budgetUsd: spec.estimatedBudgetUsd,
        estimatedHours: spec.estimatedHours,
        demandGrowthPct: spec.demandGrowthPct,
      },
    });

    const rec = await recommendBestAgent(spec as ProjectSpec);
    let bestAgentId: string | null = null;
    let bestConf: number | null = null;

    if (rec.best) {
      bestAgentId = rec.best.agentId;
      bestConf = rec.best.confidencePct;
      await prisma.project.update({
        where: { id: project.id },
        data: { bestAgentId, bestConfidence: bestConf, status: 'IN_PROGRESS' },
      });
      await prisma.projectBid.create({
        data: {
          projectId: project.id,
          agentId: rec.best.agentId,
          confidencePct: rec.best.confidencePct,
          quoteUsd: spec.estimatedBudgetUsd,
          status: 'ACCEPTED',
          breakdown: rec.best.breakdown as any,
        },
      });
    }

    out.push({ ...spec, projectId: project.id, bestAgentId, bestConfidencePct: bestConf, candidatesEvaluated: rec.candidatesEvaluated });
    logger.info(`[recommendation] project ${project.id} -> best agent ${bestAgentId} (${bestConf}%) from ${rec.candidatesEvaluated} candidates`);
  }
  return out;
}

/** Recommend the best agent for an existing/adhoc project spec (no autogen). */
export async function recommendForSpec(spec: ProjectSpec) {
  return recommendBestAgent(spec);
}
