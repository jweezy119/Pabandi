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
function logActivity(entry: any) {
  try { mkdirSync('.data', { recursive: true }); appendFileSync(ACTIVITY, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'); } catch { /* */ }
  try {
    prisma.gigEvent.create({ data: {
      kind: entry.kind, role: entry.role, gigId: entry.gigId, source: entry.source || 'ai-loop',
      skill: entry.skill ?? null, budgetUsd: entry.budgetUsd ?? null, category: entry.category ?? null,
      claimedBy: entry.claimedBy ?? null, rakeSol: entry.rakeSol ?? null, helperSol: entry.helperSol ?? null,
      referralCode: entry.referralCode ?? null,
    } });
  } catch { /* non-fatal */ }
}
let state: SegState = readState();

/** PROJECT OWNERS loop: post N demand-driven gigs from the autogen seed. */
export async function runProjectOwnerLoop(n = 3, referralCode = 'PABANDI'): Promise<any[]> {
  state = readState(); // resume cumulative counters after a cold start
  const out: any[] = [];
  for (const s of topDemandSkills(n)) {
    try {
      const g = await gigService.createGigFromSme({ skill: s.skill, referralCode });
      out.push(g.gigId);
      logActivity({ kind: 'POST', role: 'project-owner', gigId: g.gigId, skill: s.skill, budgetUsd: g.budgetUsd, category: g.category, source: 'ai-loop' });
      // Broadcast the new gig as a marketing post (DRY_RUN-safe; flips LIVE with SOCIAL_LIVE).
      try {
        const { marketingAgent } = await import('./marketingAgent.service');
        await marketingAgent.generateAndPost().catch(() => {});
      } catch { /* marketing optional */ }
    } catch (e) { logger.warn('[loop:owners] post failed', e); }
  }
  state.projectOwners = { lastRun: new Date().toISOString(), posted: state.projectOwners.posted + out.length, running: false };
  saveState(state);
  logger.info(`[loop:owners] posted ${out.length} gigs`);
  return out;
}

/** FREELANCER loop: scan OPEN board, claim + deliver best-fit gigs (autonomous booking+completion). */
export async function runFreelancerLoop(limit = 10): Promise<any[]> {
  state = readState(); // resume cumulative counters after a cold start
  const board = await gigService.openBoard(limit);
  const out: any[] = [];
  for (const g of board) {
    try {
      const rec = await recommendBestAgent({
        title: g.title, description: '', category: g.category, requiredSkills: g.requiredSkills, budgetUsd: g.budgetUsd,
      } as ProjectSpec);
      const claim = await gigService.claimGig(g.gigId, rec.best ? { agentId: rec.best.agentId } : {});
      const done = await gigService.completeGig(g.gigId);
      out.push({ gigId: g.gigId, claimedBy: claim.claimedBy, rakeSol: done.rakeSol, helperSol: done.helperSol });
      logActivity({ kind: 'COMPLETE', role: 'freelancer', gigId: g.gigId, claimedBy: claim.claimedBy, rakeSol: done.rakeSol, helperSol: done.helperSol, source: 'ai-loop' });
      state.freelancers.completed += 1;
    } catch (e) { logger.warn('[loop:freelancers] claim/complete failed', e); }
  }
  state.freelancers = { lastRun: new Date().toISOString(), claimed: state.freelancers.claimed + board.length, completed: state.freelancers.completed, running: false };
  saveState(state);
  logger.info(`[loop:freelancers] worked ${out.length} gigs`);
  return out;
}

let timers: NodeJS.Timeout[] = [];
/** Start both segments on intervals. Opt-in via AUTONOMOUS_LOOPS=true. */
export function startLoops(ownerMs = 3_600_000, freelancerMs = 1_800_000) {
  if ((process.env.AUTONOMOUS_LOOPS || 'false').toLowerCase() !== 'true') {
    logger.info('[loop] autonomous loops OFF (set AUTONOMOUS_LOOPS=true to enable)');
    return;
  }
  timers.push(setInterval(() => { runProjectOwnerLoop().catch(() => {}); }, ownerMs));
  timers.push(setInterval(() => { runFreelancerLoop().catch(() => {}); }, freelancerMs));
  logger.info('[loop] autonomous segments started: project-owners + freelancers');
}
export function stopLoops() { timers.forEach((t) => clearInterval(t)); timers = []; }

export const loopService = { runProjectOwnerLoop, runFreelancerLoop, startLoops, stopLoops, state: () => state, recentActivity, loopStats };

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
