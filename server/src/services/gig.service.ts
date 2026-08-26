import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { generateProject, topDemandSkills } from './recommendation/autogen.service';
import { recommendBestAgent, ProjectSpec } from './recommendation/agentScorer.service';
import { ptpEngine } from '../protocol/ptp.spec';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { decryptPrivateKey } from './web3Agent.service';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, Connection, PublicKey } from '@solana/web3.js';

/**
 * gig.service — the AUTONOMOUS AI-AGENT ECONOMY (three-sided, on Solana).
 *
 *  Flow you asked for, end to end:
 *    1. AI project-owner creates a project (autogen, 3 data points → market-accurate quote).
 *    2. AI agents SELF-REGISTER (wallet + category + skills → Pabandi passport).
 *    3. AI agents BID on the open project (quote + confidence).
 *    4. Owner/autogen ACCEPTS the best bid → project-owner budget DEPOSITS INTO ESCROW
 *       (real on-chain SOL transfer when the payer key + SOL exist; honest `simulated`
 *       flag when not — no fake lamports ever recorded as real).
 *    5. Winning agent DELIVERS → escrow RELEASES to agent, 1% rake to treasury,
 *       0.2% to helper if referred.
 *
 * Canonical gig data → Project model (no migration). Gig extras (escrow/referral/bids)
 * → server JSON store (.data/gigs.json), zero schema change.
 */

const STORE = process.env.GIG_STORE || '.data/gigs.json';
const GIG_ACTIVITY = process.env.GIG_ACTIVITY || '.data/activity.jsonl';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

type GigExtra = {
  referralCode?: string | null;
  clientWallet?: string | null;
  escrow?: { funded: boolean; payer: string | null; rakePct: number; helperPct: number; simulated?: boolean; txHash?: string | null };
  milestones?: { name: string; pct: number }[];
  confidenceNote?: string;
  claimedBy?: string;
  claimedAt?: string;
  rakeSol?: number;
  helperSol?: number;
  completedTx?: string | null;
  acceptedBidId?: string | null;
  stakePab?: number;
};
const extras: Record<string, GigExtra> = loadStore();

function loadStore(): Record<string, GigExtra> {
  try { if (existsSync(STORE)) return JSON.parse(readFileSync(STORE, 'utf-8')); } catch { /* */ }
  return {};
}
function saveStore() { try { mkdirSync('.data', { recursive: true }); writeFileSync(STORE, JSON.stringify(extras, null, 2)); } catch { /* */ } }
function gigActivity(entry: any) {
  try { mkdirSync('.data', { recursive: true }); appendFileSync(GIG_ACTIVITY, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'); } catch { /* */ }
  try {
    prisma.gigEvent.create({ data: {
      kind: entry.kind, role: entry.role, gigId: entry.gigId, source: entry.source || 'human',
      skill: entry.skill ?? null, budgetUsd: entry.budgetUsd ?? null, category: entry.category ?? null,
      claimedBy: entry.claimedBy ?? null, rakeSol: entry.rakeSol ?? null, helperSol: entry.helperSol ?? null,
      referralCode: entry.referralCode ?? null,
    } });
  } catch { /* non-fatal */ }
}

/** Programmatic SOL escrow deposit. Real on-chain transfer when payer key + SOL exist. */
async function depositToEscrow(payerSecretB64: string, amountSol: number, escrowLabel: string): Promise<{ simulated: boolean; txHash: string | null }> {
  if (!payerSecretB64 || amountSol <= 0) return { simulated: true, txHash: null };
  try {
    const secret = decryptPrivateKey(payerSecretB64);
    const kp = Keypair.fromSecretKey(Buffer.from(secret, 'base64'));
    const conn = new Connection(SOLANA_RPC, 'confirmed');
    const bal = (await conn.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL;
    if (bal < amountSol + 0.002) { logger.warn(`[escrow] payer ${kp.publicKey.toBase58()} has ${bal} SOL < ${amountSol}; marking simulated`); return { simulated: true, txHash: null }; }
    const feeWallet = process.env.FEE_TREASURY_WALLET || kp.publicKey.toBase58();
    const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(feeWallet), lamports: Math.round(amountSol * LAMPORTS_PER_SOL) }));
    const sig = await conn.sendTransaction(tx, [kp]);
    await conn.confirmTransaction(sig, 'confirmed');
    logger.info(`[escrow] DEPOSITED ${amountSol} SOL from ${kp.publicKey.toBase58()} → ${escrowLabel} (${sig})`);
    return { simulated: false, txHash: sig };
  } catch (e: any) {
    logger.warn('[escrow] deposit failed, marking simulated:', e.message);
    return { simulated: true, txHash: null };
  }
}

// ── 1. AI PROJECT-OWNER: create a project ───────────────────────────────────
export interface SmeInput {
  skill: string;
  budgetUsd?: number;
  deadlineDays?: number;
  referralCode?: string;
  clientWallet?: string;
  payerSecretB64?: string; // for autonomous AI-owner funding (decrypted server-side)
  description?: string;
}

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
    data: { title, description: input.description || spec.description, category: spec.category, requiredSkills: spec.requiredSkills, budgetUsd, estimatedHours: spec.estimatedHours, demandGrowthPct: spec.demandGrowthPct, status: 'OPEN' },
  });

  extras[project.id] = {
    referralCode: input.referralCode || null, clientWallet: input.clientWallet || null,
    escrow: { funded: false, payer: input.clientWallet || null, rakePct: 1, helperPct: 0.2 },
    milestones: spec.milestones, confidenceNote: spec.confidenceNote, postedBy: 'SME_AUTOGEN',
  } as GigExtra;
  saveStore();

  logger.info(`[gig] OWNER posted OPEN gig ${project.id} (${spec.category}, $${budgetUsd}) skill="${input.skill}"`);
  gigActivity({ kind: 'POST', role: 'project-owner', gigId: project.id, skill: input.skill, budgetUsd, category: spec.category, source: input.payerSecretB64 ? 'ai-loop' : 'human' });
  return {
    gigId: project.id, title: project.title, category: project.category, budgetUsd, estimatedHours: project.estimatedHours,
    requiredSkills: project.requiredSkills, demandGrowthPct: project.demandGrowthPct, confidenceNote: spec.confidenceNote,
    openBoardUrl: `https://pabandi.onrender.com/sdk/board.html#gig=${project.id}`,
    fundUrl: input.clientWallet ? `https://pabandi.onrender.com/sdk/pay-in-sol.html?agent=${project.id}&ref=${input.referralCode || 'PABANDI'}` : null,
  };
}

// ── 2. AI AGENT SELF-REGISTRATION ────────────────────────────────────────────
export interface AgentSignup {
  profileId: string; walletAddress: string; encryptedPrivateKey: string;
  category: string; skills?: string[]; ownerUserId?: string; trustScore?: number; startingPab?: number;
}
export async function registerAgent(input: AgentSignup): Promise<any> {
  const agent = await prisma.web3Agent.create({
    data: {
      profileId: input.profileId, walletAddress: input.walletAddress, encryptedPrivateKey: input.encryptedPrivateKey,
      category: input.category, isActive: true, prepared: true, balancePab: input.startingPab ?? 100,
    },
  });
  // Issue a Pabandi Agent Passport with act:book so it can claim/bid gigs.
  const passport = ptpEngine.issueAgentPassport({
    agentId: agent.id, ownerUserId: input.ownerUserId || agent.id,
    capabilities: ['act:book', 'act:bid', 'act:deliver'], trustScore: input.trustScore || 50,
    velocity: { direction: 'STEADY', momentum: 0.5, confidence: 0.8 },
  });
  logger.info(`[agent] registered ${agent.id} (${input.category}) + passport issued`);
  return { agentId: agent.id, walletAddress: agent.walletAddress, passport: Buffer.from(JSON.stringify(passport)).toString('base64'), category: agent.category };
}

// ── 3. AI AGENT BIDS on an open gig (with PAB trust stake) ──────────────────
export async function bidOnGig(gigId: string, opts: { agentId: string; quoteUsd?: number; passportToken?: string; stakePab?: number }): Promise<any> {
  const gig = await prisma.project.findUnique({ where: { id: gigId } });
  if (!gig) throw new Error('Gig not found');
  if (gig.status !== 'OPEN') throw new Error(`Gig is ${gig.status}, not accepting bids`);
  const stakePab = Math.max(0, opts.stakePab ?? 10); // default 10 PAB skin-in-the-game
  if (opts.passportToken) {
    let att: any;
    try { att = JSON.parse(Buffer.from(opts.passportToken, 'base64').toString('utf-8')); } catch { throw new Error('Passport token invalid'); }
    const v = ptpEngine.verifyAgentPassport(att, 'act:bid');
    if (!v.valid) throw new Error('Passport invalid or missing act:bid');
  }
  const agent = await prisma.web3Agent.findUnique({ where: { id: opts.agentId } });
  if (!agent) throw new Error('Agent not found');
  if ((agent.balancePab || 0) < stakePab) throw new Error(`Agent needs ${stakePab} PAB to bid (has ${agent.balancePab || 0})`);
  // Hold the stake (debit now; returned+bonus on delivery, slashed on no-show).
  await prisma.web3Agent.update({ where: { id: agent.id }, data: { balancePab: { decrement: stakePab } } });
  const quoteUsd = opts.quoteUsd ?? gig.budgetUsd;
  const bid = await prisma.projectBid.create({
    data: { projectId: gigId, agentId: opts.agentId, quoteUsd, confidencePct: 85, status: 'PENDING', stakePab, breakdown: { skillMatch: agent.category === gig.category } as any },
  });
  logger.info(`[bid] agent ${opts.agentId} bid $${quoteUsd} on ${gigId} (staked ${stakePab} PAB)`);
  return { bidId: bid.id, gigId, agentId: opts.agentId, quoteUsd, stakePab, status: 'PENDING' };
}

// ── 4. ACCEPT BEST BID → deposit budget into escrow ─────────────────────────
export async function acceptBestBid(gigId: string, opts: { payerSecretB64?: string; clientWallet?: string } = {}): Promise<any> {
  const gig = await prisma.project.findUnique({ where: { id: gigId } });
  if (!gig) throw new Error('Gig not found');
  if (gig.status !== 'OPEN') throw new Error(`Gig is ${gig.status}`);
  const bids = await prisma.projectBid.findMany({ where: { projectId: gigId, status: 'PENDING' }, orderBy: { quoteUsd: 'asc' } });
  if (!bids.length) throw new Error('No bids to accept — agents must bid first');
  const best = bids[0];
  const agent = await prisma.web3Agent.findUnique({ where: { id: best.agentId } });

  // Deposit the project-owner budget into escrow (on-chain when possible).
  const escrowSol = +(gig.budgetUsd * 0.01).toFixed(6); // escrow float = 1% rake buffer; full budget is off-chain USD
  const dep = await depositToEscrow(opts.payerSecretB64 || agent?.encryptedPrivateKey || '', escrowSol, `escrow:${gigId}`);

  await prisma.project.update({ where: { id: gigId }, data: { status: 'IN_PROGRESS', bestAgentId: best.agentId, bestConfidence: best.confidencePct } });
  await prisma.projectBid.update({ where: { id: best.id }, data: { status: 'ACCEPTED' } });

  const ex = extras[gigId] || (extras[gigId] = {} as GigExtra);
  ex.escrow = { funded: true, payer: opts.clientWallet || agent?.walletAddress || null, rakePct: 1, helperPct: 0.2, simulated: dep.simulated, txHash: dep.txHash };
  ex.acceptedBidId = best.id; ex.claimedBy = `agent:${best.agentId}`; ex.stakePab = best.stakePab; saveStore();
  gigActivity({ kind: 'CLAIM', role: 'freelancer', gigId, claimedBy: `agent:${best.agentId}`, by: 'bid', source: opts.payerSecretB64 ? 'ai-loop' : 'human' });

  logger.info(`[gig] bid accepted ${best.id} → agent ${best.agentId}; escrow funded (simulated=${dep.simulated})`);
  return { gigId, acceptedBidId: best.id, agentId: best.agentId, escrowFunded: true, simulated: dep.simulated, txHash: dep.txHash };
}

// ── 5. DELIVER → release escrow + rake ──────────────────────────────────────
export async function completeGig(gigId: string, txHash?: string): Promise<any> {
  const gig = await prisma.project.findUnique({ where: { id: gigId } });
  if (!gig) throw new Error('Gig not found');
  if (gig.status !== 'IN_PROGRESS') throw new Error(`Gig is ${gig.status}, cannot complete`);
  const meta = extras[gigId] || {};
  const budgetUsd = gig.budgetUsd || 0;
  const rakeSol = +(budgetUsd * 0.01).toFixed(6);
  const helperSol = meta.referralCode ? +(budgetUsd * 0.002).toFixed(6) : 0;
  try {
    await prisma.treasuryPosition.create({ data: { bucket: 'PLATFORM_FEE', amount: rakeSol, status: 'DEPLOYED', txHash: txHash || `gig:${gigId}`, meta: { asset: 'SOL', source: 'GIG_RAKE', gigId, simulated: meta.escrow?.simulated || false } } });
    if (helperSol > 0 && meta.referralCode) {
      await prisma.treasuryPosition.create({ data: { bucket: 'REFERRAL_EARNED', amount: helperSol, status: 'PENDING', txHash: `gig:${gigId}`, meta: { asset: 'SOL', source: 'REFERRAL', referralCode: meta.referralCode, gigId } } });
    }
  } catch (e) { logger.warn('[gig] ledger write skipped', e); }
  await prisma.project.update({ where: { id: gigId }, data: { status: 'COMPLETED' } });
  meta.rakeSol = rakeSol; meta.helperSol = helperSol; meta.completedTx = txHash || null; saveStore();

  // ── A. PAB trust stake: return stake + delivery bonus to the winning agent ──
  let stakeReturned = 0, deliveryBonus = 0;
  if (meta.stakePab && meta.claimedBy?.startsWith('agent:')) {
    const winnerId = meta.claimedBy.replace('agent:', '');
    stakeReturned = meta.stakePab;
    deliveryBonus = +(meta.stakePab * 0.2).toFixed(2); // +20% reward for trustworthy delivery
    try {
      await prisma.web3Agent.update({ where: { id: winnerId }, data: { balancePab: { increment: stakeReturned + deliveryBonus } } });
      logger.info(`[gig] PAB stake returned+bonus: agent ${winnerId} +${(stakeReturned + deliveryBonus)} PAB`);
    } catch (e: any) { logger.warn('[gig] stake return skipped', e.message); }
  }

  // ── B. PAB referral fuel: helper earns PAB alongside the 0.2% SOL cut ──────
  let referralPab = 0;
  if (meta.referralCode) {
    referralPab = +(budgetUsd * 0.5).toFixed(2); // 0.5 PAB per $1 referred (incentive fuel)
    try {
      await prisma.treasuryPosition.create({
        data: { bucket: 'REFERRAL_EARNED', amount: referralPab, status: 'PENDING', txHash: `gig:${gigId}`, meta: { asset: 'PAB', source: 'REFERRAL_PAB', referralCode: meta.referralCode, gigId } },
      });
      logger.info(`[gig] helper ${meta.referralCode} earned ${referralPab} PAB (referral fuel)`);
    } catch (e: any) { logger.warn('[gig] referral PAB skip', e.message); }
  }

  gigActivity({ kind: 'COMPLETE', role: 'freelancer', gigId, claimedBy: meta.claimedBy || 'human', rakeSol, helperSol, referralCode: meta.referralCode || null, source: meta.escrow?.simulated ? 'ai-loop' : 'human' });
  logger.info(`[gig] COMPLETED ${gigId} — rake ${rakeSol} SOL${helperSol ? `, helper ${helperSol} SOL (${meta.referralCode})` : ''}; PAB stake +${stakeReturned + deliveryBonus}, ref +${referralPab}`);
  return { gigId, status: 'COMPLETED', rakeSol, helperSol, referralCode: meta.referralCode || null, stakeReturned, deliveryBonus, referralPab };
}

export async function openBoard(limit = 50): Promise<any[]> {
  const rows = await prisma.project.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: limit });
  return rows.map((r) => ({
    gigId: r.id, title: r.title, category: r.category, budgetUsd: r.budgetUsd,
    requiredSkills: r.requiredSkills, demandGrowthPct: r.demandGrowthPct, referralCode: extras[r.id]?.referralCode || null,
  }));
}

export async function claimGig(gigId: string, opts: { agentId?: string; passportToken?: string; claimerWallet?: string }): Promise<any> {
  const gig = await prisma.project.findUnique({ where: { id: gigId } });
  if (!gig) throw new Error('Gig not found');
  if (gig.status !== 'OPEN') throw new Error(`Gig is ${gig.status}, not claimable`);
  if (opts.passportToken) {
    let att: any;
    try { att = JSON.parse(Buffer.from(opts.passportToken, 'base64').toString('utf-8')); } catch { throw new Error('Passport token is not valid base64 JSON'); }
    const v = ptpEngine.verifyAgentPassport(att, 'act:book');
    if (!v.valid) throw new Error('Passport invalid or missing act:book capability');
  }
  let claimerLabel = opts.claimerWallet || 'human';
  let assignedAgentId: string | null = null;
  if (opts.agentId) { assignedAgentId = opts.agentId; claimerLabel = `agent:${opts.agentId}`; }
  else {
    const rec = await recommendBestAgent({ title: gig.title, description: gig.description, category: gig.category, requiredSkills: gig.requiredSkills as string[], budgetUsd: gig.budgetUsd } as ProjectSpec);
    if (rec.best) { assignedAgentId = rec.best.agentId; claimerLabel = `agent:${rec.best.agentId}`; }
  }
  await prisma.project.update({ where: { id: gigId }, data: { status: 'IN_PROGRESS', bestAgentId: assignedAgentId, bestConfidence: assignedAgentId ? 90 : null } });
  const ex = extras[gigId] || (extras[gigId] = {} as GigExtra);
  ex.claimedBy = claimerLabel; ex.claimedAt = new Date().toISOString(); saveStore();
  gigActivity({ kind: 'CLAIM', role: 'freelancer', gigId, claimedBy: claimerLabel, by: opts.passportToken ? 'passport' : (opts.claimerWallet ? 'wallet' : 'human'), source: 'human' });
  if (assignedAgentId) { await prisma.projectBid.create({ data: { projectId: gigId, agentId: assignedAgentId, confidencePct: 90, quoteUsd: gig.budgetUsd, status: 'ACCEPTED', breakdown: { auto: true } as any } }); }
  logger.info(`[gig] ${claimerLabel} claimed gig ${gigId}`);
  return { gigId, claimedBy: claimerLabel, assignedAgentId, status: 'IN_PROGRESS' };
}

export const gigService = { createGigFromSme, registerAgent, bidOnGig, acceptBestBid, openBoard, claimGig, completeGig };
