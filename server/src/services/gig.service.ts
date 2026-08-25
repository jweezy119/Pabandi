import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { generateProject, topDemandSkills } from './recommendation/autogen.service';
import { recommendBestAgent, ProjectSpec } from './recommendation/agentScorer.service';
import { ptpEngine } from '../protocol/ptp.spec';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';

const GIG_ACTIVITY = process.env.GIG_ACTIVITY || '.data/activity.jsonl';
function gigActivity(entry: any) {
  try { mkdirSync('.data', { recursive: true }); appendFileSync(GIG_ACTIVITY, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'); } catch { /* */ }
  // Durable: also write to DB so counters/feed survive cold starts.
  try {
    prisma.gigEvent.create({ data: {
      kind: entry.kind, role: entry.role, gigId: entry.gigId, source: entry.source || 'human',
      skill: entry.skill ?? null, budgetUsd: entry.budgetUsd ?? null, category: entry.category ?? null,
      claimedBy: entry.claimedBy ?? null, rakeSol: entry.rakeSol ?? null, helperSol: entry.helperSol ?? null,
      referralCode: entry.referralCode ?? null,
    } });
  } catch { /* non-fatal */ }
}

/**
 * gig.service — the THREE-SIDED HELPING LOOP, on the existing rail.
 *
 *   Requestor (SME/PM) gives 3 data points ─┐
 *                                            ├─▶ autogen → Project(OPEN) + SOL escrow ref
 *   Acceptor (AI agent w/ freelance profile) ─┤   → open board → claim (passport-gated)
 *                                            │   → deliver → complete → 1% rake to treasury
 *   Helper (referral ?ref=) ────────────────┘             → 0.2% to helper if referred
 *
 * Canonical gig fields use the existing Project model (no migration). Gig extras
 * (referral/escrow/claim) live in a server-side JSON store — zero schema change, safe
 * to deploy. When the live DB is migrated later, these move into Project.metadata.
 */

const STORE = process.env.GIG_STORE || '.data/gigs.json';
type GigExtra = {
  referralCode?: string | null;
  clientWallet?: string | null;
  escrow?: { funded: boolean; payer: string | null; rakePct: number; helperPct: number };
  milestones?: { name: string; pct: number }[];
  confidenceNote?: string;
  claimedBy?: string;
  claimedAt?: string;
  rakeSol?: number;
  helperSol?: number;
  completedTx?: string | null;
};
const extras: Record<string, GigExtra> = loadStore();

function loadStore(): Record<string, GigExtra> {
  try {
    if (existsSync(STORE)) return JSON.parse(readFileSync(STORE, 'utf-8'));
  } catch { /* ignore */ }
  return {};
}
function saveStore() {
  try { mkdirSync('.data', { recursive: true }); writeFileSync(STORE, JSON.stringify(extras, null, 2)); } catch { /* ignore */ }
}

export interface SmeInput {
  skill: string;            // e.g. "AI automation (n8n/workflows)"
  budgetUsd?: number;       // optional; if absent autogen derives market-accurate quote
  deadlineDays?: number;    // optional; affects urgency multiplier
  referralCode?: string;    // helper's code (?ref=)
  clientWallet?: string;    // SOL payer for escrow (requestor)
  description?: string;     // free text override
}

/** Requestor: 3 data points → real, market-accurate, escrowed gig on the open board. */
export async function createGigFromSme(input: SmeInput): Promise<any> {
  if (!input.skill) throw new Error('skill is required (the one data point that matters)');
  const seed = topDemandSkills(40).find((s) => s.skill.toLowerCase().includes(input.skill.toLowerCase()));
  const complexity = input.budgetUsd && input.budgetUsd > 1500 ? 3 : input.budgetUsd && input.budgetUsd > 600 ? 2 : 1;
  const urgency = input.deadlineDays && input.deadlineDays <= 7 ? 2 : input.deadlineDays && input.deadlineDays <= 14 ? 1 : 0;

  const spec = generateProject(input.skill, {
    complexity: complexity as 0 | 1 | 2 | 3,
    urgency: urgency as 0 | 1 | 2,
    hours: input.budgetUsd ? Math.round(input.budgetUsd / (seed?.medianRateUsd || 70)) : undefined,
  }) || generateProject(topDemandSkills(1)[0].skill);

  if (!spec) throw new Error('Could not generate a project for that skill');

  const budgetUsd = input.budgetUsd ?? spec.estimatedBudgetUsd;
  const title = input.description ? `${input.skill} — ${input.description.slice(0, 60)}` : spec.title;

  const project = await prisma.project.create({
    data: {
      title,
      description: input.description || spec.description,
      category: spec.category,
      requiredSkills: spec.requiredSkills,
      budgetUsd,
      estimatedHours: spec.estimatedHours,
      demandGrowthPct: spec.demandGrowthPct,
      status: 'OPEN',
    },
  });

  extras[project.id] = {
    referralCode: input.referralCode || null,
    clientWallet: input.clientWallet || null,
    escrow: { funded: false, payer: input.clientWallet || null, rakePct: 1, helperPct: 0.2 },
    milestones: spec.milestones,
    confidenceNote: spec.confidenceNote,
    postedBy: 'SME_AUTOGEN',
  } as GigExtra;
  saveStore();

  logger.info(`[gig] SME posted OPEN gig ${project.id} (${spec.category}, $${budgetUsd}) skill="${input.skill}"`);
  return {
    gigId: project.id,
    title: project.title,
    category: project.category,
    budgetUsd,
    estimatedHours: project.estimatedHours,
    requiredSkills: project.requiredSkills,
    demandGrowthPct: project.demandGrowthPct,
    confidenceNote: spec.confidenceNote,
    openBoardUrl: `https://pabandi.onrender.com/sdk/board.html#gig=${project.id}`,
    fundUrl: input.clientWallet
      ? `https://pabandi.onrender.com/sdk/pay-in-sol.html?agent=${project.id}&ref=${input.referralCode || 'PABANDI'}`
      : null,
  };
}

/** Open board: every worker (human or AI agent) sees claimable gigs. */
export async function openBoard(limit = 50): Promise<any[]> {
  const rows = await prisma.project.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: limit });
  return rows.map((r) => ({
    gigId: r.id,
    title: r.title,
    category: r.category,
    budgetUsd: r.budgetUsd,
    requiredSkills: r.requiredSkills,
    demandGrowthPct: r.demandGrowthPct,
    referralCode: extras[r.id]?.referralCode || null,
  }));
}

/**
 * Acceptor claims a gig. Requires a valid Pabandi Agent Passport with `act:book`
 * (the "we're not scared to care, we verify" layer). Picks the best agent by trust,
 * or lets a human claim with their own wallet.
 */
export async function claimGig(gigId: string, opts: { agentId?: string; passportToken?: string; claimerWallet?: string }): Promise<any> {
  const gig = await prisma.project.findUnique({ where: { id: gigId } });
  if (!gig) throw new Error('Gig not found');
  if (gig.status !== 'OPEN') throw new Error(`Gig is ${gig.status}, not claimable`);

  if (opts.passportToken) {
    let att: any;
    try { att = JSON.parse(Buffer.from(opts.passportToken, 'base64').toString('utf-8')); }
    catch { throw new Error('Passport token is not valid base64 JSON'); }
    const v = ptpEngine.verifyAgentPassport(att, 'act:book');
    if (!v.valid) throw new Error('Passport invalid or missing act:book capability');
  }

  let claimerLabel = opts.claimerWallet || 'human';
  let assignedAgentId: string | null = null;

  if (opts.agentId) {
    assignedAgentId = opts.agentId;
    claimerLabel = `agent:${opts.agentId}`;
  } else {
    const rec = await recommendBestAgent({
      title: gig.title, description: gig.description, category: gig.category,
      requiredSkills: gig.requiredSkills as string[], budgetUsd: gig.budgetUsd,
    } as ProjectSpec);
    if (rec.best) { assignedAgentId = rec.best.agentId; claimerLabel = `agent:${rec.best.agentId}`; }
  }

  await prisma.project.update({
    where: { id: gigId },
    data: { status: 'IN_PROGRESS', bestAgentId: assignedAgentId, bestConfidence: assignedAgentId ? 90 : null },
  });

  const ex = extras[gigId] || (extras[gigId] = {} as GigExtra);
  ex.claimedBy = claimerLabel; ex.claimedAt = new Date().toISOString(); saveStore();

  gigActivity({ kind: 'CLAIM', role: 'freelancer', gigId, claimedBy: claimerLabel, by: opts.passportToken ? 'passport' : (opts.claimerWallet ? 'wallet' : 'human'), source: 'human' });

  if (assignedAgentId) {
    await prisma.projectBid.create({
      data: { projectId: gigId, agentId: assignedAgentId, confidencePct: 90, quoteUsd: gig.budgetUsd, status: 'ACCEPTED', breakdown: { auto: true } as any },
    });
  }

  logger.info(`[gig] ${claimerLabel} claimed gig ${gigId}`);
  return { gigId, claimedBy: claimerLabel, assignedAgentId, status: 'IN_PROGRESS' };
}

/**
 * Delivery completed → release SOL escrow → 1% rake to treasury, 0.2% to helper if referred.
 */
export async function completeGig(gigId: string, txHash?: string): Promise<any> {
  const gig = await prisma.project.findUnique({ where: { id: gigId } });
  if (!gig) throw new Error('Gig not found');
  if (gig.status !== 'IN_PROGRESS') throw new Error(`Gig is ${gig.status}, cannot complete`);

  const meta = extras[gigId] || {};
  const budgetUsd = gig.budgetUsd || 0;
  const rakeSol = +(budgetUsd * 0.01).toFixed(6);
  const helperSol = meta.referralCode ? +(budgetUsd * 0.002).toFixed(6) : 0;

  try {
    await prisma.treasuryPosition.create({
      data: { bucket: 'PLATFORM_FEE', amount: rakeSol, status: 'DEPLOYED', txHash: txHash || `gig:${gigId}`, meta: { asset: 'SOL', source: 'GIG_RAKE', gigId } },
    });
    if (helperSol > 0 && meta.referralCode) {
      await prisma.treasuryPosition.create({
        data: { bucket: 'REFERRAL_EARNED', amount: helperSol, status: 'PENDING', txHash: `gig:${gigId}`, meta: { asset: 'SOL', source: 'REFERRAL', referralCode: meta.referralCode, gigId } },
      });
    }
  } catch (e) { logger.warn('[gig] ledger write skipped', e); }

  await prisma.project.update({ where: { id: gigId }, data: { status: 'COMPLETED' } });
  meta.rakeSol = rakeSol; meta.helperSol = helperSol; meta.completedTx = txHash || null; saveStore();
  gigActivity({ kind: 'COMPLETE', role: 'freelancer', gigId, claimedBy: meta.claimedBy || 'human', rakeSol, helperSol, referralCode: meta.referralCode || null, source: 'human' });

  logger.info(`[gig] COMPLETED ${gigId} — rake ${rakeSol} SOL${helperSol ? `, helper ${helperSol} SOL (${meta.referralCode})` : ''}`);
  return { gigId, status: 'COMPLETED', rakeSol, helperSol, referralCode: meta.referralCode || null };
}

export const gigService = { createGigFromSme, openBoard, claimGig, completeGig };
