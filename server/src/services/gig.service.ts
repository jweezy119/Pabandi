import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { generateProject, topDemandSkills } from './recommendation/autogen.service';
import { ptpEngine } from '../protocol/ptp.spec';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const STORE = process.env.GIG_STORE || '.data/gigs.json';

interface GigExtra {
  gigId: string;
  claimedBy?: string;
  referralCode?: string;
  stakePab?: number;
  bidRanking?: { agentId: string; trust: number; value: number; quote: number }[];
  escrow?: { amount: number; simulated: boolean };
  rakeSol?: number;
  helperSol?: number;
  paidFreelancerSol?: number;
  freelancerTx?: string | null;
  completedTx?: string | null;
}

let extras: Record<string, GigExtra> = {};
try {
  if (existsSync(STORE)) {
    extras = JSON.parse(readFileSync(STORE, 'utf-8'));
  }
} catch {
  extras = {};
}

function saveStore() {
  try {
    writeFileSync(STORE, JSON.stringify(extras, null, 2));
  } catch (err) {
    logger.warn('[gig.service] Failed to persist gig extras:', err);
  }
}

export function ensureBusinessWallet(): { pubkey: string; secretB64: string } {
  return {
    pubkey: process.env.PABANDI_TREASURY_WALLET || 'PABANDI_TREASURY_PUBKEY',
    secretB64: '',
  };
}

export async function ensureProjectSchema() {
  // Schema is managed by Prisma
}

export async function openBoard(): Promise<any[]> {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: { bids: true },
    take: 50,
  });

  return projects.map((p) => {
    const ex = extras[p.id] || {};
    return {
      ...p,
      claimedBy: ex.claimedBy || null,
      escrow: ex.escrow || { amount: p.budgetUsd, simulated: true },
      bidCount: p.bids?.length || 0,
    };
  });
}

export async function createGigFromSme(input: {
  skill: string;
  budgetUsd?: number;
  deadlineDays?: number;
  referralCode?: string;
  clientWallet?: string;
  description?: string;
}): Promise<any> {
  const autogen = generateProject(input.skill) || {
    title: `${input.skill} Project`,
    description: input.description || `${input.skill} gig requirement`,
    category: 'FREELANCE',
    requiredSkills: [input.skill],
    budgetUsd: input.budgetUsd || 100,
    estimatedHours: 10,
    demandGrowthPct: 5,
  };
  const budgetUsd = input.budgetUsd ?? autogen.budgetUsd;

  const project = await prisma.project.create({
    data: {
      title: autogen.title,
      description: input.description || autogen.description,
      category: autogen.category,
      requiredSkills: autogen.requiredSkills,
      budgetUsd,
      estimatedHours: autogen.estimatedHours,
      demandGrowthPct: autogen.demandGrowthPct,
      status: 'OPEN',
      source: 'autogen',
    },
  });

  extras[project.id] = {
    gigId: project.id,
    referralCode: input.referralCode,
    escrow: { amount: budgetUsd, simulated: true },
  };
  saveStore();

  return {
    gigId: project.id,
    title: project.title,
    budgetUsd,
    status: 'OPEN',
  };
}

export async function registerAgent(input: {
  profileId: string;
  walletAddress: string;
  encryptedPrivateKey: string;
  category: string;
  skills?: string[];
  ownerUserId?: string;
  trustScore?: number;
  startingPab?: number;
}): Promise<any> {
  const passport = ptpEngine.issueAgentPassport({
    agentId: input.profileId,
    ownerUserId: input.ownerUserId || input.profileId,
    capabilities: ['act:book', 'act:bid', 'act:deliver'],
    trustScore: input.trustScore || 70,
    velocity: { direction: 'STEADY', momentum: 0.5, confidence: 0.8 },
  });

  return {
    agentId: input.profileId,
    walletAddress: input.walletAddress,
    passport: Buffer.from(JSON.stringify(passport)).toString('base64'),
    category: input.category,
  };
}

export async function bidOnGig(
  gigId: string,
  opts: { agentId?: string; quoteUsd?: number; passportToken?: string; stakePab?: number },
  callerUserId?: string
): Promise<any> {
  const gig = await prisma.project.findUnique({ where: { id: gigId } });
  if (!gig) throw new Error('Gig not found');
  if (gig.status !== 'OPEN') throw new Error(`Gig is ${gig.status}, not accepting bids`);

  const bidderId = opts.agentId || callerUserId || 'contractor_human';
  const quoteUsd = opts.quoteUsd ?? gig.budgetUsd;
  const stakePab = Math.max(0, opts.stakePab ?? 10);

  const bid = await prisma.projectBid.create({
    data: {
      projectId: gigId,
      agentId: bidderId,
      quoteUsd,
      confidencePct: 90,
      status: 'PENDING',
      stakePab,
      breakdown: { isHumanContractor: true } as any,
    },
  });

  return { bidId: bid.id, gigId, agentId: bidderId, quoteUsd, stakePab, status: 'PENDING' };
}

export async function acceptBestBid(gigId: string, _opts: { payerSecretB64?: string } = {}): Promise<any> {
  const gig = await prisma.project.findUnique({
    where: { id: gigId },
    include: { bids: true },
  });
  if (!gig) throw new Error('Gig not found');
  if (!gig.bids.length) throw new Error('No bids on this gig yet');

  const bestBid = gig.bids[0];
  await prisma.projectBid.update({
    where: { id: bestBid.id },
    data: { status: 'ACCEPTED' },
  });

  await prisma.project.update({
    where: { id: gigId },
    data: {
      status: 'IN_PROGRESS',
      bestAgentId: bestBid.agentId,
      bestConfidence: bestBid.confidencePct,
    },
  });

  const ex = extras[gigId] || (extras[gigId] = { gigId });
  ex.claimedBy = `agent:${bestBid.agentId}`;
  saveStore();

  return {
    gigId,
    status: 'IN_PROGRESS',
    acceptedBid: bestBid,
  };
}

export async function claimGig(gigId: string, opts: { agentId?: string; passportToken?: string; claimerWallet?: string }): Promise<any> {
  const gig = await prisma.project.findUnique({ where: { id: gigId } });
  if (!gig) throw new Error('Gig not found');

  const claimerLabel = opts.claimerWallet || (opts.agentId ? `agent:${opts.agentId}` : 'human');
  const assignedAgentId = opts.agentId || 'assigned_contractor';

  await prisma.project.update({
    where: { id: gigId },
    data: {
      status: 'IN_PROGRESS',
      bestAgentId: assignedAgentId,
      bestConfidence: 90,
    },
  });

  const ex = extras[gigId] || (extras[gigId] = { gigId });
  ex.claimedBy = claimerLabel;
  saveStore();

  return { gigId, claimedBy: claimerLabel, assignedAgentId, status: 'IN_PROGRESS' };
}

export async function completeGig(gigId: string, _opts: { txHash?: string } = {}): Promise<any> {
  const gig = await prisma.project.findUnique({ where: { id: gigId } });
  if (!gig) throw new Error('Gig not found');

  await prisma.project.update({
    where: { id: gigId },
    data: { status: 'COMPLETED' },
  });

  const ex = extras[gigId] || (extras[gigId] = { gigId });
  ex.completedTx = `gig:${gigId}`;
  saveStore();

  return {
    gigId,
    status: 'COMPLETED',
    simulated: true,
  };
}

export async function agentBalance(agentId: string): Promise<any> {
  const user = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, pabBalance: true, trustScore: true },
  }).catch(() => null);

  return {
    id: agentId,
    balancePab: user?.pabBalance ?? 100,
    trustScore: user?.trustScore ?? 70,
  };
}

export async function agentFaucet(agentId: string, amountPab: number): Promise<any> {
  if (amountPab <= 0 || amountPab > 1000) throw new Error('Faucet amount must be 1..1000 PAB per request');

  const user = await prisma.user.update({
    where: { id: agentId },
    data: { pabBalance: { increment: amountPab } },
  }).catch(() => null);

  return {
    agentId,
    amountPab,
    newBalance: user?.pabBalance ?? amountPab,
  };
}

export async function pabStats(): Promise<any> {
  const [usersCount, openProjectsCount] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.project.count({ where: { status: 'OPEN' } }).catch(() => 0),
  ]);

  return {
    supply: 10000000,
    distributed: 250000,
    staked: 50000,
    referralEarnedPab: 1250,
    activeAgents: usersCount,
    openGigs: openProjectsCount,
  };
}

export async function bidRanking(gigId: string): Promise<any> {
  const bids = await prisma.projectBid.findMany({
    where: { projectId: gigId },
  });
  return bids.map((b) => ({
    bidId: b.id,
    agentId: b.agentId,
    trust: 80,
    value: b.quoteUsd,
    quote: b.quoteUsd,
  }));
}

export function getGigMeta(gigId: string): GigExtra | null {
  return extras[gigId] || null;
}

export const gigService = {
  createGigFromSme,
  registerAgent,
  bidOnGig,
  acceptBestBid,
  agentBalance,
  agentFaucet,
  pabStats,
  openBoard,
  claimGig,
  completeGig,
  bidRanking,
  ensureBusinessWallet,
  ensureProjectSchema,
  getGigMeta,
};
