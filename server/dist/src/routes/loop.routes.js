"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const loop_service_1 = require("../services/loop.service");
const program_service_1 = require("../services/program.service");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
/** GET /api/v1/loops/selfcheck — proves the live Prisma client can write+read GigEvent (cache-bust verification). */
router.get('/selfcheck', async (_req, res, next) => {
    try {
        const before = await database_1.prisma.gigEvent.count();
        const row = await database_1.prisma.gigEvent.create({ data: { kind: 'SELFCHECK', role: 'system', gigId: 'selfcheck', source: 'ai-loop' } });
        const after = await database_1.prisma.gigEvent.count();
        await database_1.prisma.gigEvent.delete({ where: { id: row.id } });
        res.json({ success: true, data: { clientLive: true, before, after, wrote: after === before + 1 } });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message, clientLive: false });
    }
});
/** GET /api/v1/loops — segment state + durable cumulative stats. */
router.get('/', async (_req, res) => {
    const stats = await loop_service_1.loopService.loopStats().catch(() => ({ posted: 0, completed: 0, claimed: 0, open: 0 }));
    res.json({ success: true, data: { ...loop_service_1.loopService.state(), stats } });
});
/** GET /api/v1/loops/activity — live feed of recent post/claim/complete events (durable DB). */
router.get('/activity', async (_req, res) => {
    const rows = await loop_service_1.loopService.recentActivity(20).catch(() => []);
    res.json({ success: true, data: rows });
});
/** GET /api/v1/loops/agent — the autonomous freelancer agent's live PAB trust state. */
router.get('/agent', async (_req, res, next) => {
    try {
        const agent = await (await Promise.resolve().then(() => __importStar(require('../utils/database')))).prisma.web3Agent.findFirst({ where: { isActive: true }, orderBy: { balancePab: 'desc' } });
        if (!agent)
            return res.json({ success: true, data: null });
        res.json({ success: true, data: { agentId: agent.id, category: agent.category, balancePab: agent.balancePab, walletAddress: agent.walletAddress } });
    }
    catch (e) {
        next(e);
    }
});
/** GET /api/v1/loops/stats — durable counters (survive cold starts). */
router.get('/stats', async (_req, res) => {
    const stats = await loop_service_1.loopService.loopStats().catch(() => ({ posted: 0, completed: 0, claimed: 0, open: 0 }));
    res.json({ success: true, data: stats });
});
/** POST /api/v1/loops/owners/run — manually trigger the project-owner (requestor) loop. */
router.post('/owners/run', async (req, res, next) => {
    try {
        const n = (req.body || {}).n || 3;
        const ids = await loop_service_1.loopService.runProjectOwnerLoop(n, (req.body || {}).referralCode || 'PABANDI');
        res.json({ success: true, data: { posted: ids.length, gigIds: ids } });
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/v1/loops/freelancers/run — manually trigger the freelancer (acceptor) loop. */
router.post('/freelancers/run', async (req, res, next) => {
    try {
        const out = await loop_service_1.loopService.runFreelancerLoop((req.body || {}).limit || 10);
        res.json({ success: true, data: { worked: out.length, results: out } });
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/v1/loops/wake — fire the autonomous heartbeat once (catch-up). Called by the board/launch
 *  page on load so the open board is never empty when a human visits, even on Render Free (sleeps when idle).
 *  Phases: owner posts gigs (up to pipeline target) → agents BID (gigs stay OPEN with competing bids → visible board).
 *  Delivery is deliberately NOT in wake — it runs on a slower cadence via the 24/7 pinger, so the board
 *  shows a living pipeline of open, competing gigs rather than emptying instantly. */
router.post('/wake', async (_req, res) => {
    res.json({ success: true, data: { triggered: true, note: 'autonomous heartbeat running' } });
    loop_service_1.loopService.runProjectOwnerLoop(3, 'PABANDI', 6).catch(() => { });
    setTimeout(() => loop_service_1.loopService.runFreelancerLoop(10).catch(() => { }), 1200); // bid phase: gigs stay OPEN w/ competing bids
});
/** POST /api/v1/loops/heartbeat — full cycle including delivery + program advancement. Used by the 24/7 external pinger (slow cadence). */
router.post('/heartbeat', async (_req, res) => {
    res.json({ success: true, data: { triggered: true, note: 'full cycle incl. delivery + programs' } });
    loop_service_1.loopService.runProjectOwnerLoop(2, 'PABANDI', 6).catch(() => { });
    setTimeout(() => loop_service_1.loopService.runFreelancerLoop(10).catch(() => { }), 1200);
    setTimeout(() => loop_service_1.loopService.runFreelancerDeliver(2).catch(() => { }), 5000); // deliver a few → feed shows delivery
    setTimeout(() => program_service_1.programService.runAllPrograms().catch(() => { }), 6000); // advance any active programs
});
/** POST /api/v1/loops/freelancers/deliver — accept best bid + deliver a limited number of open gigs. */
router.post('/freelancers/deliver', async (req, res, next) => {
    try {
        const out = await loop_service_1.loopService.runFreelancerDeliver((req.body || {}).limit || 2);
        res.json({ success: true, data: { delivered: out.length, results: out } });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=loop.routes.js.map