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
exports.loopService = void 0;
exports.runProjectOwnerLoop = runProjectOwnerLoop;
exports.runFreelancerLoop = runFreelancerLoop;
exports.runFreelancerDeliver = runFreelancerDeliver;
exports.startLoops = startLoops;
exports.stopLoops = stopLoops;
exports.recentActivity = recentActivity;
exports.loopStats = loopStats;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const gig_service_1 = require("./gig.service");
const program_service_1 = require("./program.service");
const autogen_service_1 = require("./recommendation/autogen.service");
const fs_1 = require("fs");
/**
 * loop.service — SEGMENTED autonomous AI-agent economy.
 *
 * Two roles, two continuous loops, one shared "folder" (JSON segment state, zero migration):
 *
 *  ┌─ PROJECT OWNERS (requestors) ──────────────┐
 *  │  Autonomous: pull top demand skills → post  │
 *  │  market-accurate gigs to the open board.     │
 *  └──────────────────────────────────────────────┘
 *                        │  (open board)
 *  ┌─ FREELANCERS (acceptors) ──────────────────┐
 *  │  Autonomous: scan open board → claim best-  │
 *  │  fit gig (passport-gated) → deliver → complete│
 *  └──────────────────────────────────────────────┘
 *                        │
 *              SOL rake + helper kickback → treasury
 *
 * Both loops run on timers (opt-in via env). They are SAFE: project owners only post
 * from the curated demand seed; freelancers only claim OPEN gigs and record delivery
 * (no treasury SOL moved by the loop itself — real funding is the client's SOL).
 */
const STORE = process.env.LOOP_STORE || '.data/loops.json';
const ACTIVITY = process.env.LOOP_ACTIVITY || '.data/activity.jsonl';
// PERSIST across cold starts: always re-read the file at the start of each run so a Render
// restart resumes cumulative counters instead of zeroing them.
function readState() {
    try {
        if ((0, fs_1.existsSync)(STORE))
            return JSON.parse((0, fs_1.readFileSync)(STORE, 'utf-8'));
    }
    catch { /* */ }
    return { projectOwners: { lastRun: '', posted: 0, running: false }, freelancers: { lastRun: '', claimed: 0, completed: 0, running: false } };
}
function saveState(s) { try {
    (0, fs_1.mkdirSync)('.data', { recursive: true });
    (0, fs_1.writeFileSync)(STORE, JSON.stringify(s, null, 2));
}
catch { /* */ } }
async function logActivity(entry) {
    try {
        (0, fs_1.mkdirSync)('.data', { recursive: true });
        (0, fs_1.appendFileSync)(ACTIVITY, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
    }
    catch { /* */ }
    try {
        await database_1.prisma.gigEvent.create({ data: {
                kind: entry.kind, role: entry.role, gigId: entry.gigId, source: entry.source || 'ai-loop',
                skill: entry.skill ?? null, budgetUsd: entry.budgetUsd ?? null, category: entry.category ?? null,
                claimedBy: entry.claimedBy ?? null, rakeSol: entry.rakeSol ?? null, helperSol: entry.helperSol ?? null,
                referralCode: entry.referralCode ?? null,
            } });
    }
    catch (e) {
        logger_1.logger.warn('[gigEvent] write failed', e.message);
    }
}
let state = readState();
/** PROJECT OWNERS loop: post demand-driven gigs, but only enough to keep a healthy OPEN pipeline
 *  (so the board is always alive without unbounded growth). */
async function runProjectOwnerLoop(n = 3, referralCode = 'PABANDI', targetOpen = 6) {
    state = readState(); // resume cumulative counters after a cold start
    const openCount = await database_1.prisma.project.count({ where: { status: 'OPEN' } });
    const toPost = Math.max(0, Math.min(n, targetOpen - openCount));
    if (toPost <= 0) {
        logger_1.logger.info(`[loop:owners] pipeline full (${openCount} open), skipping post`);
        return [];
    }
    const out = [];
    for (const s of (0, autogen_service_1.topDemandSkills)(toPost)) {
        try {
            const g = await gig_service_1.gigService.createGigFromSme({ skill: s.skill, referralCode });
            out.push(g.gigId);
            await logActivity({ kind: 'POST', role: 'project-owner', gigId: g.gigId, skill: s.skill, budgetUsd: g.budgetUsd, category: g.category, source: 'ai-loop' });
            try {
                const { marketingAgent } = await Promise.resolve().then(() => __importStar(require('./marketingAgent.service')));
                await marketingAgent.generateAndPost().catch(() => { });
            }
            catch { /* marketing optional */ }
        }
        catch (e) {
            logger_1.logger.warn('[loop:owners] post failed', e);
        }
    }
    state.projectOwners = { lastRun: new Date().toISOString(), posted: state.projectOwners.posted + out.length, running: false };
    saveState(state);
    logger_1.logger.info(`[loop:owners] posted ${out.length} gigs (open pipeline ${openCount}→${openCount + out.length})`);
    return out;
}
/** FREELANCER loop (BID phase): scan OPEN board → MULTIPLE AI agents COMPETE (bid + stake PAB).
 *  Gigs are LEFT OPEN with their competing bids visible on the board — a living marketplace. */
async function runFreelancerLoop(limit = 10) {
    state = readState();
    const board = await gig_service_1.gigService.openBoard(limit);
    if (!board.length) {
        logger_1.logger.info('[loop:freelancers] board empty');
        return [];
    }
    const roster = await ensureRoster(board[0].category);
    if (!roster.length) {
        logger_1.logger.warn('[loop:freelancers] no agents available');
        return [];
    }
    const out = [];
    for (const g of board) {
        try {
            // Skip gigs that already have a full competing set of bids.
            const existing = await database_1.prisma.projectBid.count({ where: { projectId: g.gigId, status: 'PENDING' } });
            if (existing >= roster.length) {
                out.push({ gigId: g.gigId, note: 'already competing', bids: existing });
                continue;
            }
            const bids = [];
            for (const a of roster) {
                if ((a.balancePab || 0) < 20)
                    await gig_service_1.gigService.agentFaucet(a.id, 100);
                const quote = Math.round(g.budgetUsd * (0.88 + Math.random() * 0.12));
                const b = await gig_service_1.gigService.bidOnGig(g.gigId, { agentId: a.id, quoteUsd: quote, stakePab: 10 });
                bids.push(b);
            }
            await logActivity({ kind: 'BID', role: 'freelancer', gigId: g.gigId, claimedBy: `agents:${roster.length}`, source: 'ai-loop' });
            out.push({ gigId: g.gigId, competingBids: bids.length });
        }
        catch (e) {
            logger_1.logger.warn('[loop:freelancers] bid failed', e.message);
        }
    }
    saveState(state);
    logger_1.logger.info(`[loop:freelancers] ${out.length} gigs now have competing bids`);
    return out;
}
/** FREELANCER loop (DELIVER phase): accept best bid + deliver a limited number of OPEN gigs,
 *  so the board shows live deliveries in the feed WITHOUT emptying (keeps a healthy pipeline). */
async function runFreelancerDeliver(limit = 2) {
    state = readState();
    const open = await database_1.prisma.project.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: limit });
    const out = [];
    for (const g of open) {
        try {
            const accept = await gig_service_1.gigService.acceptBestBid(g.id);
            const done = await gig_service_1.gigService.completeGig(g.id);
            await logActivity({ kind: 'COMPLETE', role: 'freelancer', gigId: g.id, claimedBy: `agent:${accept.agentId}`, rakeSol: done.rakeSol, helperSol: done.helperSol, source: 'ai-loop' });
            state.freelancers.completed += 1;
            out.push({ gigId: g.id, winner: accept.agentId, stakeReturned: done.stakeReturned, deliveryBonus: done.deliveryBonus, referralPab: done.referralPab, rakeSol: done.rakeSol });
        }
        catch (e) {
            logger_1.logger.warn('[loop:freelancers] deliver failed', e.message);
        }
    }
    state.freelancers = { lastRun: new Date().toISOString(), claimed: state.freelancers.claimed, completed: state.freelancers.completed, running: false };
    saveState(state);
    logger_1.logger.info(`[loop:freelancers] delivered ${out.length} gigs`);
    return out;
}
/** Ensure a roster of N competing autonomous agents exists for a category.
 *  Each gets a DISTINCT trust stake so capability-weighting is meaningful: a proven "veteran"
 *  (high stake) beats a no-name undercutter — exactly the "right freelancer" guarantee. */
async function ensureRoster(category, n = 3) {
    let agents = await database_1.prisma.web3Agent.findMany({ where: { isActive: true }, orderBy: { balancePab: 'desc' }, take: n });
    const stakes = [5000, 2500, 800]; // veteran, mid, junior — varies the trust signal on purpose
    while (agents.length < n) {
        const slot = agents.length;
        const reg = await gig_service_1.gigService.registerAgent({
            profileId: `loop-agent-${slot + 1}-${Date.now()}`, walletAddress: '5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG',
            encryptedPrivateKey: 'demo', category, startingPab: stakes[slot] ?? 500,
        });
        const a = await database_1.prisma.web3Agent.findUnique({ where: { id: reg.agentId } });
        if (a)
            agents.push(a);
    }
    return agents;
}
let timers = [];
/** Start both segments on intervals. Opt-in via AUTONOMOUS_LOOPS=true. */
function startLoops(ownerMs = 3600000, freelancerMs = 1800000) {
    if ((process.env.AUTONOMOUS_LOOPS || 'false').toLowerCase() !== 'true') {
        logger_1.logger.info('[loop] autonomous loops OFF (set AUTONOMOUS_LOOPS=true to enable)');
        return;
    }
    // Owner posts up to pipeline target; freelancers bid (open) + deliver a few (slow cadence);
    // programs advance (staff next task / complete finished ones).
    // Runs only while the process is awake; the external 24/7 pinger (POST /loops/heartbeat) covers idle gaps.
    timers.push(setInterval(() => {
        runProjectOwnerLoop(2, 'PABANDI', 6).catch(() => { });
        setTimeout(() => runFreelancerLoop(10).catch(() => { }), 1500);
        setTimeout(() => runFreelancerDeliver(2).catch(() => { }), 5000);
        setTimeout(() => program_service_1.programService.runAllPrograms().catch(() => { }), 6000);
    }, ownerMs));
    logger_1.logger.info('[loop] autonomous segments started (project-owners + freelancers bid+deliver + programs)');
}
function stopLoops() { timers.forEach((t) => clearInterval(t)); timers = []; }
exports.loopService = { runProjectOwnerLoop, runFreelancerLoop, runFreelancerDeliver, startLoops, stopLoops, state: () => state, recentActivity, loopStats };
/** Live activity feed (last N events) — reads durable DB so it survives cold starts. */
async function recentActivity(n = 20) {
    try {
        const rows = await database_1.prisma.gigEvent.findMany({ orderBy: { createdAt: 'desc' }, take: n });
        if (rows.length)
            return rows.map((r) => ({ ts: r.createdAt, kind: r.kind, role: r.role, gigId: r.gigId, source: r.source, skill: r.skill, budgetUsd: r.budgetUsd, category: r.category, claimedBy: r.claimedBy, rakeSol: r.rakeSol, helperSol: r.helperSol, referralCode: r.referralCode }));
    }
    catch { /* fall back to file */ }
    try {
        if (!(0, fs_1.existsSync)(ACTIVITY))
            return [];
        const lines = (0, fs_1.readFileSync)(ACTIVITY, 'utf-8').trim().split('\n').filter(Boolean);
        return lines.slice(-n).map((l) => { try {
            return JSON.parse(l);
        }
        catch {
            return null;
        } }).filter(Boolean).reverse();
    }
    catch {
        return [];
    }
}
/** Durable cumulative counters from the DB (survive cold starts). */
async function loopStats() {
    try {
        const [posted, completed, claimed, open, agg] = await Promise.all([
            database_1.prisma.gigEvent.count({ where: { kind: 'POST' } }),
            database_1.prisma.gigEvent.count({ where: { kind: 'COMPLETE' } }),
            database_1.prisma.gigEvent.count({ where: { kind: 'CLAIM' } }),
            database_1.prisma.project.count({ where: { status: 'OPEN' } }),
            database_1.prisma.gigEvent.aggregate({ where: { kind: 'COMPLETE' }, _sum: { rakeSol: true } }),
        ]);
        return { posted, completed, claimed, open, rakeSol: agg._sum.rakeSol || 0 };
    }
    catch {
        return { posted: 0, completed: 0, claimed: 0, open: 0, rakeSol: 0 };
    }
}
//# sourceMappingURL=loop.service.js.map