"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAKE_REQUIRED_PAB = void 0;
exports.scoreAgent = scoreAgent;
exports.recommendBestAgent = recommendBestAgent;
const database_1 = require("../../utils/database");
const logger_1 = require("../../utils/logger");
const walletProfile_adapter_1 = require("./walletProfile.adapter");
const SIX_MONTHS_DAYS = 182;
/**
 * First-party Pabandi history — the strongest, free, real signal.
 * We trust our OWN recorded behavior over any external oracle:
 *  - completionRate: % of bookings COMPLETED (vs cancelled / no-show)
 *  - onTimeRate: % completed within 7d of creation
 *  - slashPenalty: historical slashes drag the score (genuine accuracy)
 *  - realVolume: count of NON-simulated bookings (proves production activity)
 * Returns a 0..25 component.
 */
async function firstPartySignal(agentId) {
    const bookings = await database_1.prisma.agentBooking.findMany({
        where: { OR: [{ fromAgentId: agentId }, { toAgentId: agentId }] },
        select: { status: true, simulated: true, createdAt: true, completedAt: true },
    });
    const stake = await database_1.prisma.agentStake.findUnique({ where: { agentId } });
    const real = bookings.filter((b) => !b.simulated);
    const total = real.length;
    if (total === 0) {
        // No first-party track record yet — neutral, not penalized (new agents start fresh)
        return { score: 0, detail: { total: 0, completionRate: null, onTimeRate: null, slashedPab: stake?.slashedPab || 0 } };
    }
    const completed = real.filter((b) => b.status === 'COMPLETED').length;
    const cancelled = real.filter((b) => b.status === 'CANCELLED' || b.status === 'NO_SHOW').length;
    const onTime = real.filter((b) => b.status === 'COMPLETED' && b.completedAt && b.createdAt && b.completedAt.getTime() - b.createdAt.getTime() <= 7 * 86400000).length;
    const completionRate = completed / total;
    const onTimeRate = completed ? onTime / completed : 0;
    const slashPab = stake?.slashedPab || 0;
    // Score: completionRate up to +15, onTimeRate up to +10, minus slash penalty up to -10
    let score = completionRate * 15 + onTimeRate * 10;
    if (slashPab > 0)
        score -= Math.min(10, slashPab / 200); // 2000 PAB slashed => -10
    score = Math.max(0, Math.min(25, score));
    return { score: Math.round(score * 10) / 10, detail: { total, completionRate: Math.round(completionRate * 100), onTimeRate: Math.round(onTimeRate * 100), slashedPab: slashPab } };
}
function skillMatchScore(spec, profile) {
    // Map project skills to on-chain program-interaction signals.
    const skills = (spec.requiredSkills || []).map((s) => s.toLowerCase());
    let score = 0;
    const hasAnchor = skills.some((s) => ['anchor', 'rust', 'solana program', 'bpf', 'smart contract'].includes(s));
    if (hasAnchor && profile.anchorDeploys > 0)
        score += Math.min(50, profile.anchorDeploys * 12);
    const hasDefi = skills.some((s) => ['defi', 'lend', 'yield', 'treasury', 'kamino', 'solend'].includes(s));
    if (hasDefi && profile.defiInteractions > 0)
        score += Math.min(25, profile.defiInteractions * 5);
    // General activity still contributes a little for non-program skills (design, video, etc.)
    if (score === 0 && profile.txCount > 20)
        score = 10;
    return Math.min(50, score);
}
function scoreProfile(spec, profile) {
    const warmUp = profile.ageDays >= SIX_MONTHS_DAYS ? 20 : Math.round((profile.ageDays / SIX_MONTHS_DAYS) * 20);
    const income = profile.recurringIncome ? 30 : Math.round((Math.min(profile.incomeStreams, 2) / 2) * 30);
    let defiHealth = 0;
    if (profile.ltvPct === null)
        defiHealth = 5; // no leverage = neutral-good
    else if (profile.ltvPct < 50)
        defiHealth = 10;
    else if (profile.ltvPct > 80)
        defiHealth = -20;
    else
        defiHealth = 0;
    const skillMatch = skillMatchScore(spec, profile);
    const reliability = profile.failedTxRatio > 0 ? -Math.min(25, Math.round(profile.failedTxRatio * 100)) : 0;
    const freshness = profile.lastActiveDays > 30 ? -10 : 0;
    const total = Math.max(0, Math.min(100, warmUp + income + defiHealth + skillMatch + reliability + freshness));
    return { warmUp, income, defiHealth, skillMatch, reliability, freshness, firstParty: 0, total };
}
/**
 * Score a single agent against a project spec. Pulls fresh wallet profile (cached 10m
 * inside the adapter layer via caller if desired). Uses the agent's Pabandi stake to
 * gate: unstaked agents are not indexed (skin-in-the-game requirement).
 */
async function scoreAgent(agentId, spec) {
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: agentId } });
    if (!agent)
        return null;
    const stake = await database_1.prisma.agentStake.findUnique({ where: { agentId } });
    if (!stake || stake.amountPab < exports.STAKE_REQUIRED_PAB) {
        // Not indexed — skin in the game not met. Return null so it never appears in ranking.
        return null;
    }
    const profile = await (0, walletProfile_adapter_1.getWalletProfile)(agent.walletAddress);
    const breakdown = scoreProfile(spec, profile);
    // First-party Pabandi history is the strongest, free, real signal — fold it in.
    const fp = await firstPartySignal(agentId);
    breakdown.firstParty = fp.score;
    // recompute total cleanly (include firstParty)
    breakdown.total = Math.max(0, Math.min(100, breakdown.warmUp + breakdown.income + breakdown.defiHealth + breakdown.skillMatch + breakdown.reliability + breakdown.freshness + breakdown.firstParty));
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
async function recommendBestAgent(spec) {
    const agents = await database_1.prisma.web3Agent.findMany({ where: { isActive: true } });
    const ranked = [];
    for (const a of agents) {
        try {
            const s = await scoreAgent(a.id, spec);
            if (s)
                ranked.push(s);
        }
        catch (e) {
            logger_1.logger.warn(`[agentScorer] score failed for ${a.id}: ${e.message}`);
        }
    }
    ranked.sort((x, y) => y.breakdown.total - x.breakdown.total);
    return { best: ranked[0] || null, candidatesEvaluated: ranked.length, ranked: ranked.slice(0, 5) };
}
exports.STAKE_REQUIRED_PAB = 2000;
//# sourceMappingURL=agentScorer.service.js.map