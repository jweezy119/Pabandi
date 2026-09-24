"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAutogenLoop = runAutogenLoop;
exports.recommendForSpec = recommendForSpec;
const database_1 = require("../../utils/database");
const logger_1 = require("../../utils/logger");
const agentScorer_service_1 = require("./agentScorer.service");
const autogen_service_1 = require("./autogen.service");
/** Generate demand-driven projects, post them, and run the recommendation engine on each. */
async function runAutogenLoop(limit = 8) {
    const specs = (0, autogen_service_1.generatePipeline)(limit);
    const out = [];
    for (const spec of specs) {
        const project = await database_1.prisma.project.create({
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
        const rec = await (0, agentScorer_service_1.recommendBestAgent)(spec);
        let bestAgentId = null;
        let bestConf = null;
        if (rec.best) {
            bestAgentId = rec.best.agentId;
            bestConf = rec.best.confidencePct;
            await database_1.prisma.project.update({
                where: { id: project.id },
                data: { bestAgentId, bestConfidence: bestConf, status: 'IN_PROGRESS' },
            });
            await database_1.prisma.projectBid.create({
                data: {
                    projectId: project.id,
                    agentId: rec.best.agentId,
                    confidencePct: rec.best.confidencePct,
                    quoteUsd: spec.estimatedBudgetUsd,
                    status: 'ACCEPTED',
                    breakdown: rec.best.breakdown,
                },
            });
        }
        out.push({ ...spec, projectId: project.id, bestAgentId, bestConfidencePct: bestConf, candidatesEvaluated: rec.candidatesEvaluated });
        logger_1.logger.info(`[recommendation] project ${project.id} -> best agent ${bestAgentId} (${bestConf}%) from ${rec.candidatesEvaluated} candidates`);
    }
    return out;
}
/** Recommend the best agent for an existing/adhoc project spec (no autogen). */
async function recommendForSpec(spec) {
    return (0, agentScorer_service_1.recommendBestAgent)(spec);
}
//# sourceMappingURL=recommendation.service.js.map