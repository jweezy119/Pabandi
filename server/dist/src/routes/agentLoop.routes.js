"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * agentLoop.routes.ts — Control + observe the AI-agent booking loop.
 *
 *  POST /prepare-live   Pre-create all agent PAB ATAs + fund each agent with SOL for tx
 *                       fees (one-time, ~0.13 SOL for 65 agents). Makes a small SOL
 *                       balance (e.g. 0.6) viable for LIVE on-chain bookings.
 *  POST /run-once       Run one booking cycle now (respects LIVE_BOOKINGS env).
 *  GET  /state          Current loop state (running, live, totals).
 *  GET  /sol-buffer     Funded-wallet SOL balance + how many agents hold SOL.
 */
const express_1 = require("express");
const agentLoop_service_1 = require("../services/agentLoop.service");
const web3Agent_service_1 = require("../services/web3Agent.service");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
router.post('/prepare-live', async (req, res) => {
    const { solBudget, perAgentSol } = req.body || {};
    try {
        const r = await (0, agentLoop_service_1.prepareLiveRails)({ solBudget: solBudget ? Number(solBudget) : undefined, perAgentSol: perAgentSol ? Number(perAgentSol) : undefined });
        if (r.error)
            return res.status(400).json({ success: false, error: r.error });
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/run-once', async (_req, res) => {
    try {
        const r = await (0, agentLoop_service_1.runAgentLoopCycle)();
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.get('/state', (_req, res) => {
    res.json({ success: true, data: (0, agentLoop_service_1.getAgentLoopState)() });
});
router.get('/bookings', async (_req, res) => {
    try {
        // Raw SQL — resilient if the generated @prisma/client is stale (predates AgentBooking).
        const rows = await database_1.prisma.$queryRawUnsafe('SELECT * FROM "AgentBooking" ORDER BY "createdAt" DESC LIMIT 50');
        res.json({ success: true, data: rows });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.get('/sol-buffer', async (_req, res) => {
    try {
        res.json({ success: true, data: await web3Agent_service_1.web3AgentService.liveSolBuffer() });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/start', (_req, res) => { (0, agentLoop_service_1.startAgentLoop)(); res.json({ success: true, data: (0, agentLoop_service_1.getAgentLoopState)() }); });
router.post('/stop', (_req, res) => { (0, agentLoop_service_1.stopAgentLoop)(); res.json({ success: true, data: (0, agentLoop_service_1.getAgentLoopState)() }); });
router.get('/health', async (_req, res) => {
    try {
        res.json({ success: true, data: await (0, agentLoop_service_1.getAgentLoopHealth)() });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=agentLoop.routes.js.map