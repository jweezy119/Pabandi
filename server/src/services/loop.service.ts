import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { gigService } from './gig.service';
import { topDemandSkills } from './recommendation/autogen.service';
import { recommendBestAgent, ProjectSpec } from './recommendation/agentScorer.service';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

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
type SegState = { projectOwners: { lastRun: string; posted: number; running: boolean }; freelancers: { lastRun: string; claimed: number; completed: number; running: boolean } };
let state: SegState = load();
function load(): SegState {
  try { if (existsSync(STORE)) return JSON.parse(readFileSync(STORE, 'utf-8')); } catch { /* */ }
  return { projectOwners: { lastRun: '', posted: 0, running: false }, freelancers: { lastRun: '', claimed: 0, completed: 0, running: false } };
}
function save() { try { mkdirSync('.data', { recursive: true }); writeFileSync(STORE, JSON.stringify(state, null, 2)); } catch { /* */ } }

/** PROJECT OWNERS loop: post N demand-driven gigs from the autogen seed. */
export async function runProjectOwnerLoop(n = 3, referralCode = 'PABANDI'): Promise<any[]> {
  const out: any[] = [];
  for (const s of topDemandSkills(n)) {
    try {
      const g = await gigService.createGigFromSme({ skill: s.skill, referralCode });
      out.push(g.gigId);
      // Broadcast the new gig as a marketing post (DRY_RUN-safe; flips LIVE with SOCIAL_LIVE).
      try {
        const { marketingAgent } = await import('./marketingAgent.service');
        await marketingAgent.generateAndPost().catch(() => {});
      } catch { /* marketing optional */ }
    } catch (e) { logger.warn('[loop:owners] post failed', e); }
  }
  state.projectOwners = { lastRun: new Date().toISOString(), posted: state.projectOwners.posted + out.length, running: false };
  save();
  logger.info(`[loop:owners] posted ${out.length} gigs`);
  return out;
}

/** FREELANCER loop: scan OPEN board, claim + deliver best-fit gigs (autonomous booking+completion). */
export async function runFreelancerLoop(limit = 10): Promise<any[]> {
  const board = await gigService.openBoard(limit);
  const out: any[] = [];
  for (const g of board) {
    try {
      const rec = await recommendBestAgent({
        title: g.title, description: '', category: g.category, requiredSkills: g.requiredSkills, budgetUsd: g.budgetUsd,
      } as ProjectSpec);
      const claim = await gigService.claimGig(g.gigId, rec.best ? { agentId: rec.best.agentId } : {});
      // Autonomous delivery: record completion (real delivery is the agent's work; we record the event)
      const done = await gigService.completeGig(g.gigId);
      out.push({ gigId: g.gigId, claimedBy: claim.claimedBy, rakeSol: done.rakeSol, helperSol: done.helperSol });
      state.freelancers.completed += 1;
    } catch (e) { logger.warn('[loop:freelancers] claim/complete failed', e); }
  }
  state.freelancers = { lastRun: new Date().toISOString(), claimed: state.freelancers.claimed + board.length, completed: state.freelancers.completed, running: false };
  save();
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

export const loopService = { runProjectOwnerLoop, runFreelancerLoop, startLoops, stopLoops, state: () => state };
