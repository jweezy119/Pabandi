import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { gigService } from './gig.service';
import { topDemandSkills } from './recommendation/autogen.service';
import { recommendBestAgent, ProjectSpec } from './recommendation/agentScorer.service';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';

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
type SegState = { projectOwners: { lastRun: string; posted: number; running: boolean }; freelancers: { lastRun: string; claimed: number; completed: number; running: boolean } };
// PERSIST across cold starts: always re-read the file at the start of each run so a Render
// restart resumes cumulative counters instead of zeroing them.
function readState(): SegState {
  try { if (existsSync(STORE)) return JSON.parse(readFileSync(STORE, 'utf-8')); } catch { /* */ }
  return { projectOwners: { lastRun: '', posted: 0, running: false }, freelancers: { lastRun: '', claimed: 0, completed: 0, running: false } };
}
function saveState(s: SegState) { try { mkdirSync('.data', { recursive: true }); writeFileSync(STORE, JSON.stringify(s, null, 2)); } catch { /* */ } }
async function logActivity(entry: any) {
  try { mkdirSync('.data', { recursive: true }); appendFileSync(ACTIVITY, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'); } catch { /* */ }
  try {
    await prisma.gigEvent.create({ data: {
      kind: entry.kind, role: entry.role, gigId: entry.gigId, source: entry.source || 'ai-loop',
      skill: entry.skill ?? null, budgetUsd: entry.budgetUsd ?? null, category: entry.category ?? null,
      claimedBy: entry.claimedBy ?? null, rakeSol: entry.rakeSol ?? null, helperSol: entry.helperSol ?? null,
      referralCode: entry.referralCode ?? null,
    } });
  } catch (e: any) { logger.warn('[gigEvent] write failed', e.message); }
}
let state: SegState = readState();

/** PROJECT OWNERS loop: post demand-driven gigs, but only enough to keep a healthy OPEN pipeline
 *  (so the board is always alive without unbounded growth). */
export async function runProjectOwnerLoop(n = 3, referralCode = 'PABANDI', targetOpen = 6): Promise<any[]> {
  state = readState(); // resume cumulative counters after a cold start
  const openCount = await prisma.project.count({ where: { status: 'OPEN' } });
  const toPost = Math.max(0, Math.min(n, targetOpen - openCount));
  if (toPost <= 0) { logger.info(`[loop:owners] pipeline full (${openCount} open), skipping post`); return []; }
  const out: any[] = [];
  for (const s of topDemandSkills(toPost)) {
    try {
      const g = await gigService.createGigFromSme({ skill: s.skill, referralCode });
      out.push(g.gigId);
      await logActivity({ kind: 'POST', role: 'project-owner', gigId: g.gigId, skill: s.skill, budgetUsd: g.budgetUsd, category: g.category, source: 'ai-loop' });
      try {
        const { marketingAgent } = await import('./marketingAgent.service');
        await marketingAgent.generateAndPost().catch(() => {});
      } catch { /* marketing optional */ }
    } catch (e) { logger.warn('[loop:owners] post failed', e); }
  }
  state.projectOwners = { lastRun: new Date().toISOString(), posted: state.projectOwners.posted + out.length, running: false };
  saveState(state);
  logger.info(`[loop:owners] posted ${out.length} gigs (open pipeline ${openCount}→${openCount + out.length})`);
  return out;
}

/** FREELANCER loop (BID phase): scan OPEN board → MULTIPLE AI agents COMPETE (bid + stake PAB).
 *  Gigs are LEFT OPEN with their competing bids visible on the board — a living marketplace. */
export async function runFreelancerLoop(limit = 10): Promise<any[]> {
  state = readState();
  const board = await gigService.openBoard(limit);
  if (!board.length) { logger.info('[loop:freelancers] board empty'); return []; }

  const roster = await ensureRoster(board[0].category);
  if (!roster.length) { logger.warn('[loop:freelancers] no agents available'); return []; }

  const out: any[] = [];
  for (const g of board) {
    try {
      // Skip gigs that already have a full competing set of bids.
      const existing = await prisma.projectBid.count({ where: { projectId: g.gigId, status: 'PENDING' } });
      if (existing >= roster.length) { out.push({ gigId: g.gigId, note: 'already competing', bids: existing }); continue; }
      const bids = [];
      for (const a of roster) {
        if ((a.balancePab || 0) < 20) await gigService.agentFaucet(a.id, 100);
        const quote = Math.round(g.budgetUsd * (0.88 + Math.random() * 0.12));
        const b = await gigService.bidOnGig(g.gigId, { agentId: a.id, quoteUsd: quote, stakePab: 10 });
        bids.push(b);
      }
      await logActivity({ kind: 'BID', role: 'freelancer', gigId: g.gigId, claimedBy: `agents:${roster.length}`, source: 'ai-loop' });
      out.push({ gigId: g.gigId, competingBids: bids.length });
    } catch (e: any) { logger.warn('[loop:freelancers] bid failed', e.message); }
  }
  saveState(state);
  logger.info(`[loop:freelancers] ${out.length} gigs now have competing bids`);
  return out;
}

/** FREELANCER loop (DELIVER phase): accept best bid + deliver a limited number of OPEN gigs,
 *  so the board shows live deliveries in the feed WITHOUT emptying (keeps a healthy pipeline). */
export async function runFreelancerDeliver(limit = 2): Promise<any[]> {
  state = readState();
  const open = await prisma.project.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: limit });
  const out: any[] = [];
  for (const g of open) {
    try {
      const accept = await gigService.acceptBestBid(g.id);
      const done = await gigService.completeGig(g.id);
      await logActivity({ kind: 'COMPLETE', role: 'freelancer', gigId: g.id, claimedBy: `agent:${accept.agentId}`, rakeSol: done.rakeSol, helperSol: done.helperSol, source: 'ai-loop' });
      state.freelancers.completed += 1;
      out.push({ gigId: g.id, winner: accept.agentId, stakeReturned: done.stakeReturned, deliveryBonus: done.deliveryBonus, referralPab: done.referralPab, rakeSol: done.rakeSol });
    } catch (e: any) { logger.warn('[loop:freelancers] deliver failed', e.message); }
  }
  state.freelancers = { lastRun: new Date().toISOString(), claimed: state.freelancers.claimed, completed: state.freelancers.completed, running: false };
  saveState(state);
  logger.info(`[loop:freelancers] delivered ${out.length} gigs`);
  return out;
}

/** Ensure a roster of N competing autonomous agents exists for a category. */
async function ensureRoster(category: string, n = 3): Promise<any[]> {
  let agents = await prisma.web3Agent.findMany({ where: { isActive: true }, orderBy: { balancePab: 'desc' }, take: n });
  while (agents.length < n) {
    const reg = await gigService.registerAgent({
      profileId: `loop-agent-${agents.length + 1}-${Date.now()}`, walletAddress: '5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG',
      encryptedPrivateKey: 'demo', category, startingPab: 100,
    });
    const a = await prisma.web3Agent.findUnique({ where: { id: reg.agentId } });
    if (a) agents.push(a);
  }
  return agents;
}

let timers: NodeJS.Timeout[] = [];
/** Start both segments on intervals. Opt-in via AUTONOMOUS_LOOPS=true. */
export function startLoops(ownerMs = 3_600_000, freelancerMs = 1_800_000) {
  if ((process.env.AUTONOMOUS_LOOPS || 'false').toLowerCase() !== 'true') {
    logger.info('[loop] autonomous loops OFF (set AUTONOMOUS_LOOPS=true to enable)');
    return;
  }
  // Owner posts up to pipeline target; freelancers bid (open) + deliver a few (slow cadence).
  // Runs only while the process is awake; the external 24/7 pinger (POST /loops/heartbeat) covers idle gaps.
  timers.push(setInterval(() => {
    runProjectOwnerLoop(2, 'PABANDI', 6).catch(() => {});
    setTimeout(() => runFreelancerLoop(10).catch(() => {}), 1500);
    setTimeout(() => runFreelancerDeliver(2).catch(() => {}), 5000);
  }, ownerMs));
  logger.info('[loop] autonomous segments started (project-owners + freelancers bid+deliver)');
}
export function stopLoops() { timers.forEach((t) => clearInterval(t)); timers = []; }

export const loopService = { runProjectOwnerLoop, runFreelancerLoop, runFreelancerDeliver, startLoops, stopLoops, state: () => state, recentActivity, loopStats };

/** Live activity feed (last N events) — reads durable DB so it survives cold starts. */
export async function recentActivity(n = 20): Promise<any[]> {
  try {
    const rows = await prisma.gigEvent.findMany({ orderBy: { createdAt: 'desc' }, take: n });
    if (rows.length) return rows.map((r: any) => ({ ts: r.createdAt, kind: r.kind, role: r.role, gigId: r.gigId, source: r.source, skill: r.skill, budgetUsd: r.budgetUsd, category: r.category, claimedBy: r.claimedBy, rakeSol: r.rakeSol, helperSol: r.helperSol, referralCode: r.referralCode }));
  } catch { /* fall back to file */ }
  try { if (!existsSync(ACTIVITY)) return []; const lines = readFileSync(ACTIVITY, 'utf-8').trim().split('\n').filter(Boolean); return lines.slice(-n).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse(); } catch { return []; }
}
/** Durable cumulative counters from the DB (survive cold starts). */
export async function loopStats(): Promise<{ posted: number; completed: number; claimed: number; open: number; rakeSol: number }> {
  try {
    const [posted, completed, claimed, open, agg] = await Promise.all([
      prisma.gigEvent.count({ where: { kind: 'POST' } }),
      prisma.gigEvent.count({ where: { kind: 'COMPLETE' } }),
      prisma.gigEvent.count({ where: { kind: 'CLAIM' } }),
      prisma.project.count({ where: { status: 'OPEN' } }),
      prisma.gigEvent.aggregate({ where: { kind: 'COMPLETE' }, _sum: { rakeSol: true } }),
    ]);
    return { posted, completed, claimed, open, rakeSol: agg._sum.rakeSol || 0 };
  } catch { return { posted: 0, completed: 0, claimed: 0, open: 0, rakeSol: 0 }; }
}
