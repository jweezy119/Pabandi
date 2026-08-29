"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recommendation_service_1 = require("../services/recommendation/recommendation.service");
const stakeSlashing_service_1 = require("../services/recommendation/stakeSlashing.service");
const agentScorer_service_1 = require("../services/recommendation/agentScorer.service");
const router = (0, express_1.Router)();
// Run the closed loop: generate demand-driven projects -> agents auto-bid -> recommend best.
router.post('/autogen-run', async (req, res) => {
    try {
        const limit = Math.min(Number(req.body?.limit) || 8, 20);
        const projects = await (0, recommendation_service_1.runAutogenLoop)(limit);
        res.json({ success: true, count: projects.length, projects });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err?.message || 'autogen failed' });
    }
});
// Recommend the best agent for an adhoc project spec.
router.post('/recommend', async (req, res) => {
    try {
        const spec = req.body;
        if (!spec?.requiredSkills || !Array.isArray(spec.requiredSkills)) {
            return res.status(400).json({ success: false, error: 'requiredSkills[] required' });
        }
        const rec = await (0, recommendation_service_1.recommendForSpec)(spec);
        res.json({ success: true, best: rec.best, candidatesEvaluated: rec.candidatesEvaluated, top5: rec.ranked });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err?.message || 'recommend failed' });
    }
});
// Stake an agent (skin in the game) to be indexed by the engine.
router.post('/stake', async (req, res) => {
    try {
        const { agentId, amountPab } = req.body || {};
        if (!agentId || !amountPab)
            return res.status(400).json({ success: false, error: 'agentId + amountPab required' });
        const r = await (0, stakeSlashing_service_1.stakeAgent)(agentId, Number(amountPab));
        res.json({ success: r.ok, ...(r.error ? { error: r.error } : {}), minStake: agentScorer_service_1.STAKE_REQUIRED_PAB });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err?.message || 'stake failed' });
    }
});
// Slash an agent on milestone failure (partial burn + client comp).
router.post('/slash', async (req, res) => {
    try {
        const { agentId, penaltyPct } = req.body || {};
        if (!agentId)
            return res.status(400).json({ success: false, error: 'agentId required' });
        const r = await (0, stakeSlashing_service_1.slashAgent)(agentId, penaltyPct ? Number(penaltyPct) : 0.3);
        res.json({ success: r.ok, ...(r.error ? { error: r.error } : {}), slashedPab: r.slashedPab, toClientPab: r.toClientPab, burnedPab: r.burnedPab });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err?.message || 'slash failed' });
    }
});
exports.default = router;
//# sourceMappingURL=recommendation.routes.js.map