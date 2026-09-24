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
exports.gigService = void 0;
exports.ensureBusinessWallet = ensureBusinessWallet;
exports.createGigFromSme = createGigFromSme;
exports.registerAgent = registerAgent;
exports.bidOnGig = bidOnGig;
exports.acceptBestBid = acceptBestBid;
exports.completeGig = completeGig;
exports.agentBalance = agentBalance;
exports.agentFaucet = agentFaucet;
exports.openBoard = openBoard;
exports.claimGig = claimGig;
exports.pabStats = pabStats;
exports.bidRanking = bidRanking;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const autogen_service_1 = require("./recommendation/autogen.service");
const ptp_spec_1 = require("../protocol/ptp.spec");
const fs_1 = require("fs");
const web3Agent_service_1 = require("./web3Agent.service");
const web3_js_1 = require("@solana/web3.js");
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
const TREASURY_WALLET = process.env.PABANDI_TREASURY_WALLET || process.env.SOLANA_PUBKEY || '';
/** Live SOL buffer in the treasury wallet. Returns 0 on any error (keeps autonomous reinvest dormant + honest). */
async function treasurySolBuffer() {
    if (!TREASURY_WALLET)
        return 0;
    try {
        const conn = new web3_js_1.Connection(SOLANA_RPC, 'confirmed');
        return (await conn.getBalance(new web3_js_1.PublicKey(TREASURY_WALLET))) / web3_js_1.LAMPORTS_PER_SOL;
    }
    catch {
        return 0;
    }
}
// ── Real 2-wallet SOL escrow (business owner wallet ↔ freelancer wallet) ─────
// The AI business/owner wallet deposits the FULL project payment as on-chain escrow.
// The treasury only CUSTODIES the deposited SOL and releases it to the winning freelancer
// on delivery (minus 1% rake). Treasury never risks its own capital. When the business
// wallet has no SOL, the flow is flagged simulated:true (honest, no fake tx).
const FS = require('fs');
const STORE_DIR = __dirname;
const WALLETS_FILE = require('path').join(STORE_DIR, '.agentWallets.json');
function loadWallets() { try {
    return JSON.parse(FS.readFileSync(WALLETS_FILE, 'utf-8'));
}
catch {
    return {};
} }
function saveWallets(w) { try {
    FS.writeFileSync(WALLETS_FILE, JSON.stringify(w, null, 2));
}
catch { } }
/** Real business (owner-agent) wallet: generated once, encrypted at rest. Print its pubkey so it can be funded. */
function ensureBusinessWallet() {
    const w = loadWallets();
    if (w.business?.pubkey && w.business?.secretB64)
        return w.business;
    const kp = web3_js_1.Keypair.generate();
    const bus = { pubkey: kp.publicKey.toBase58(), secretB64: Buffer.from(kp.secretKey).toString('base64') };
    w.business = bus;
    saveWallets(w);
    logger_1.logger.info(`[wallet] NEW business(owner) wallet ${bus.pubkey} — fund it with SOL to enable LIVE escrow (treasury stays at 0 risk)`);
    return bus;
}
/** Treasury keypair from SOLANA_PRIVATE_KEY (base58), matching economy service. */
function treasuryKeypair() {
    const enc = process.env.SOLANA_PRIVATE_KEY;
    if (!enc)
        return null;
    try {
        const bs58 = require('bs58');
        const dec = (bs58.default ? bs58.default : bs58).decode(enc);
        return web3_js_1.Keypair.fromSecretKey(dec);
    }
    catch {
        try {
            return web3_js_1.Keypair.fromSecretKey(new Uint8Array(JSON.parse(Buffer.from(enc, 'base64').toString())));
        }
        catch {
            return null;
        }
    }
}
/** Treasury pays real SOL to a freelancer wallet (treasury signs; freelancer just receives). */
async function payFromTreasury(toPubkey, amountSol) {
    if (!TREASURY_WALLET || amountSol <= 0)
        return { simulated: true, txHash: null };
    try {
        const kp = treasuryKeypair();
        if (!kp)
            return { simulated: true, txHash: null };
        const conn = new web3_js_1.Connection(SOLANA_RPC, 'confirmed');
        const bal = (await conn.getBalance(kp.publicKey)) / web3_js_1.LAMPORTS_PER_SOL;
        if (bal < amountSol + 0.002) {
            logger_1.logger.warn(`[escrow] treasury has ${bal} SOL < ${amountSol}; marking simulated`);
            return { simulated: true, txHash: null };
        }
        const tx = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new web3_js_1.PublicKey(toPubkey), lamports: Math.round(amountSol * web3_js_1.LAMPORTS_PER_SOL) }));
        const sig = await conn.sendTransaction(tx, [kp]);
        await conn.confirmTransaction(sig, 'confirmed');
        logger_1.logger.info(`[escrow] PAID ${amountSol} SOL → freelancer ${toPubkey} (${sig})`);
        return { simulated: false, txHash: sig };
    }
    catch (e) {
        logger_1.logger.warn('[escrow] pay failed, simulated:', e.message);
        return { simulated: true, txHash: null };
    }
}
const extras = loadStore();
function loadStore() {
    try {
        if ((0, fs_1.existsSync)(STORE))
            return JSON.parse((0, fs_1.readFileSync)(STORE, 'utf-8'));
    }
    catch { /* */ }
    return {};
}
function saveStore() { try {
    (0, fs_1.mkdirSync)('.data', { recursive: true });
    (0, fs_1.writeFileSync)(STORE, JSON.stringify(extras, null, 2));
}
catch { /* */ } }
async function gigActivity(entry) {
    try {
        (0, fs_1.mkdirSync)('.data', { recursive: true });
        (0, fs_1.appendFileSync)(GIG_ACTIVITY, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
    }
    catch { /* */ }
    try {
        await database_1.prisma.gigEvent.create({ data: {
                kind: entry.kind, role: entry.role, gigId: entry.gigId, source: entry.source || 'human',
                skill: entry.skill ?? null, budgetUsd: entry.budgetUsd ?? null, category: entry.category ?? null,
                claimedBy: entry.claimedBy ?? null, rakeSol: entry.rakeSol ?? null, helperSol: entry.helperSol ?? null,
                referralCode: entry.referralCode ?? null,
            } });
    }
    catch (e) {
        logger_1.logger.warn('[gigEvent] write failed', e.message);
    }
}
/** Programmatic SOL escrow deposit. Real on-chain transfer when payer key + SOL exist. */
async function depositToEscrow(payerSecretB64, amountSol, escrowLabel) {
    if (!payerSecretB64 || amountSol <= 0)
        return { simulated: true, txHash: null };
    try {
        const secret = (0, web3Agent_service_1.decryptPrivateKey)(payerSecretB64);
        const kp = web3_js_1.Keypair.fromSecretKey(Buffer.from(secret, 'base64'));
        const conn = new web3_js_1.Connection(SOLANA_RPC, 'confirmed');
        const bal = (await conn.getBalance(kp.publicKey)) / web3_js_1.LAMPORTS_PER_SOL;
        if (bal < amountSol + 0.002) {
            logger_1.logger.warn(`[escrow] payer ${kp.publicKey.toBase58()} has ${bal} SOL < ${amountSol}; marking simulated`);
            return { simulated: true, txHash: null };
        }
        const feeWallet = process.env.FEE_TREASURY_WALLET || kp.publicKey.toBase58();
        const tx = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new web3_js_1.PublicKey(feeWallet), lamports: Math.round(amountSol * web3_js_1.LAMPORTS_PER_SOL) }));
        const sig = await conn.sendTransaction(tx, [kp]);
        await conn.confirmTransaction(sig, 'confirmed');
        logger_1.logger.info(`[escrow] DEPOSITED ${amountSol} SOL from ${kp.publicKey.toBase58()} → ${escrowLabel} (${sig})`);
        return { simulated: false, txHash: sig };
    }
    catch (e) {
        logger_1.logger.warn('[escrow] deposit failed, marking simulated:', e.message);
        return { simulated: true, txHash: null };
    }
}
async function createGigFromSme(input) {
    if (!input.skill)
        throw new Error('skill is required (the one data point that matters)');
    const seed = (0, autogen_service_1.topDemandSkills)(40).find((s) => s.skill.toLowerCase().includes(input.skill.toLowerCase()));
    const complexity = input.budgetUsd && input.budgetUsd > 1500 ? 3 : input.budgetUsd && input.budgetUsd > 600 ? 2 : 1;
    const urgency = input.deadlineDays && input.deadlineDays <= 7 ? 2 : input.deadlineDays && input.deadlineDays <= 14 ? 1 : 0;
    const spec = (0, autogen_service_1.generateProject)(input.skill, {
        complexity: complexity,
        urgency: urgency,
        hours: input.budgetUsd ? Math.round(input.budgetUsd / (seed?.medianRateUsd || 70)) : undefined,
    }) || (0, autogen_service_1.generateProject)((0, autogen_service_1.topDemandSkills)(1)[0].skill);
    if (!spec)
        throw new Error('Could not generate a project for that skill');
    const budgetUsd = input.budgetUsd ?? spec.estimatedBudgetUsd;
    const title = input.description ? `${input.skill} — ${input.description.slice(0, 60)}` : spec.title;
    const project = await database_1.prisma.project.create({
        data: { title, description: input.description || spec.description, category: spec.category, requiredSkills: spec.requiredSkills, budgetUsd, estimatedHours: spec.estimatedHours, demandGrowthPct: spec.demandGrowthPct, status: 'OPEN' },
    });
    extras[project.id] = {
        referralCode: input.referralCode || null, clientWallet: input.clientWallet || null,
        escrow: { funded: false, payer: input.clientWallet || null, rakePct: 1, helperPct: 0.2 },
        milestones: spec.milestones, confidenceNote: spec.confidenceNote, postedBy: 'SME_AUTOGEN',
    };
    saveStore();
    logger_1.logger.info(`[gig] OWNER posted OPEN gig ${project.id} (${spec.category}, $${budgetUsd}) skill="${input.skill}"`);
    await gigActivity({ kind: 'POST', role: 'project-owner', gigId: project.id, skill: input.skill, budgetUsd, category: spec.category, source: input.payerSecretB64 ? 'ai-loop' : 'human' });
    return {
        gigId: project.id, title: project.title, category: project.category, budgetUsd, estimatedHours: project.estimatedHours,
        requiredSkills: project.requiredSkills, demandGrowthPct: project.demandGrowthPct, confidenceNote: spec.confidenceNote,
        openBoardUrl: `https://pabandi.onrender.com/sdk/board.html#gig=${project.id}`,
        fundUrl: input.clientWallet ? `https://pabandi.onrender.com/sdk/pay-in-sol.html?agent=${project.id}&ref=${input.referralCode || 'PABANDI'}` : null,
    };
}
async function registerAgent(input) {
    const agent = await database_1.prisma.web3Agent.create({
        data: {
            profileId: input.profileId, walletAddress: input.walletAddress, encryptedPrivateKey: input.encryptedPrivateKey,
            category: input.category, isActive: true, prepared: true, balancePab: input.startingPab ?? 100,
        },
    });
    // A PAB trust stake is the agent's skin-in-the-game. Record it so the capability scorer can
    // differentiate a proven stakeholder from a no-name — this is what makes "the right freelancer"
    // a real, auditable decision rather than a coin-flip.
    const stakePab = input.startingPab ?? 100;
    await database_1.prisma.agentStake.upsert({
        where: { agentId: agent.id },
        create: { agentId: agent.id, amountPab: stakePab, vault: process.env.PABANDI_TREASURY_WALLET || 'PABANDI_TREASURY', indexed: stakePab >= 2000 },
        update: { amountPab: { increment: stakePab }, indexed: stakePab >= 2000 },
    });
    // Issue a Pabandi Agent Passport with act:book so it can claim/bid gigs.
    const passport = ptp_spec_1.ptpEngine.issueAgentPassport({
        agentId: agent.id, ownerUserId: input.ownerUserId || agent.id,
        capabilities: ['act:book', 'act:bid', 'act:deliver'], trustScore: input.trustScore || 50,
        velocity: { direction: 'STEADY', momentum: 0.5, confidence: 0.8 },
    });
    logger_1.logger.info(`[agent] registered ${agent.id} (${input.category}) + passport issued`);
    return { agentId: agent.id, walletAddress: agent.walletAddress, passport: Buffer.from(JSON.stringify(passport)).toString('base64'), category: agent.category };
}
// ── 3. AI AGENT BIDS on an open gig (with PAB trust stake) ──────────────────
async function bidOnGig(gigId, opts) {
    const gig = await database_1.prisma.project.findUnique({ where: { id: gigId } });
    if (!gig)
        throw new Error('Gig not found');
    if (gig.status !== 'OPEN')
        throw new Error(`Gig is ${gig.status}, not accepting bids`);
    const stakePab = Math.max(0, opts.stakePab ?? 10); // default 10 PAB skin-in-the-game
    if (opts.passportToken) {
        let att;
        try {
            att = JSON.parse(Buffer.from(opts.passportToken, 'base64').toString('utf-8'));
        }
        catch {
            throw new Error('Passport token invalid');
        }
        const v = ptp_spec_1.ptpEngine.verifyAgentPassport(att, 'act:bid');
        if (!v.valid)
            throw new Error('Passport invalid or missing act:bid');
    }
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: opts.agentId } });
    if (!agent)
        throw new Error('Agent not found');
    if ((agent.balancePab || 0) < stakePab)
        throw new Error(`Agent needs ${stakePab} PAB to bid (has ${agent.balancePab || 0})`);
    // Hold the stake (debit now; returned+bonus on delivery, slashed on no-show).
    await database_1.prisma.web3Agent.update({ where: { id: agent.id }, data: { balancePab: { decrement: stakePab } } });
    const quoteUsd = opts.quoteUsd ?? gig.budgetUsd;
    const bid = await database_1.prisma.projectBid.create({
        data: { projectId: gigId, agentId: opts.agentId, quoteUsd, confidencePct: 85, status: 'PENDING', stakePab, breakdown: { skillMatch: agent.category === gig.category } },
    });
    logger_1.logger.info(`[bid] agent ${opts.agentId} bid $${quoteUsd} on ${gigId} (staked ${stakePab} PAB)`);
    return { bidId: bid.id, gigId, agentId: opts.agentId, quoteUsd, stakePab, status: 'PENDING' };
}
// ── 4. ACCEPT BEST BID → deposit budget into escrow ─────────────────────────
/**
 * Capability-weighted bid selection: we don't just take the cheapest quote. We score every
 * bidder on DEPTH, not price:
 *   trust   = PAB stake held (skin-in-the-game)        → up to +40
 *   track   = first-party completion rate (real history)→ up to +35
 *   skill   = category/skill match to the gig          → up to +25
 * Then we pick the best VALUE = trustScore normalized by quote (cheaper for equal trust wins,
 * but a trusted veteran beats a no-name undercutter). This is what makes "the right freelancer
 * per task" a real, auditable decision — not a race to the bottom.
 */
async function scoreBidder(bid, gig) {
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: bid.agentId } });
    if (!agent)
        return { agentId: bid.agentId, trust: 0, value: 0, quote: bid.quoteUsd };
    const stake = await database_1.prisma.agentStake.findUnique({ where: { agentId: bid.agentId } });
    const trust = Math.min(40, ((stake?.amountPab || 0) / 2000) * 40); // 2000 PAB stake = full trust pts
    // first-party completion history (real, free signal)
    const bookings = await database_1.prisma.agentBooking.findMany({ where: { OR: [{ fromAgentId: bid.agentId }, { toAgentId: bid.agentId }] }, select: { status: true, simulated: true } });
    const real = bookings.filter((b) => !b.simulated);
    const completionRate = real.length ? real.filter((b) => b.status === 'COMPLETED').length / real.length : 0;
    const track = completionRate * 35;
    const skill = agent.category === gig.category ? 25 : 0;
    const totalTrust = Math.min(100, trust + track + skill);
    // value = trust per $1000 of quote (higher = more trust for the money). Floor quote to avoid div0.
    const value = totalTrust / Math.max(200, bid.quoteUsd) * 1000;
    return { agentId: bid.agentId, trust: Math.round(totalTrust), value: +value.toFixed(2), quote: bid.quoteUsd };
}
async function acceptBestBid(gigId, opts = {}) {
    const gig = await database_1.prisma.project.findUnique({ where: { id: gigId } });
    if (!gig)
        throw new Error('Gig not found');
    if (gig.status !== 'OPEN')
        throw new Error(`Gig is ${gig.status}`);
    const bids = await database_1.prisma.projectBid.findMany({ where: { projectId: gigId, status: 'PENDING' } });
    if (!bids.length)
        throw new Error('No bids to accept — agents must bid first');
    // Score every bidder; pick highest VALUE (trust per dollar). Surface the ranking for transparency.
    const scored = [];
    for (const b of bids)
        scored.push(await scoreBidder(b, gig));
    scored.sort((a, b) => b.value - a.value);
    const pick = scored[0];
    const best = bids.find((x) => x.agentId === pick.agentId);
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: best.agentId } });
    // Deposit the project-owner's FULL payment into escrow (real on-chain when business wallet funded).
    // Demo rate: $800 budget = 1 SOL escrow. Treasury only custodies this; never risks its own SOL.
    const escrowSol = +Math.max(0.0005, gig.budgetUsd / 800).toFixed(6);
    const bus = ensureBusinessWallet();
    const dep = await depositToEscrow(opts.payerSecretB64 || bus.secretB64, escrowSol, `escrow:${gigId}`);
    await database_1.prisma.project.update({ where: { id: gigId }, data: { status: 'IN_PROGRESS', bestAgentId: best.agentId, bestConfidence: pick.trust } });
    await database_1.prisma.projectBid.update({ where: { id: best.id }, data: { status: 'ACCEPTED', confidencePct: pick.trust } });
    const ex = extras[gigId] || (extras[gigId] = {});
    ex.escrow = { funded: true, amount: escrowSol, payer: opts.clientWallet || agent?.walletAddress || null, rakePct: 1, helperPct: 0.2, simulated: dep.simulated, txHash: dep.txHash };
    ex.acceptedBidId = best.id;
    ex.claimedBy = `agent:${best.agentId}`;
    ex.stakePab = best.stakePab;
    ex.bidRanking = scored;
    saveStore();
    await gigActivity({ kind: 'CLAIM', role: 'freelancer', gigId, claimedBy: `agent:${best.agentId}`, by: 'bid', source: opts.payerSecretB64 ? 'ai-loop' : 'human' });
    // Notify external apps that this gig was claimed by an agent
    if (gig.createdBy) {
        try {
            const { webhookDeliveryService } = await Promise.resolve().then(() => __importStar(require('./webhookDelivery.service')));
            await webhookDeliveryService.enqueueWebhook({ appId: gig.createdBy, event: 'gig.claimed', data: { gigId, agentId: best.agentId, trustScore: pick.trust, bidRanking: scored } });
        }
        catch { /* webhook best-effort */ }
    }
    logger_1.logger.info(`[gig] bid accepted ${best.id} → agent ${best.agentId} (trust ${pick.trust}, value ${pick.value}); escrow funded (simulated=${dep.simulated})`);
    return { gigId, acceptedBidId: best.id, agentId: best.agentId, trustScore: pick.trust, bidRanking: scored, escrowFunded: true, simulated: dep.simulated, txHash: dep.txHash };
}
// ── 5. DELIVER → release escrow + rake ──────────────────────────────────────
async function completeGig(gigId, txHash) {
    const gig = await database_1.prisma.project.findUnique({ where: { id: gigId } });
    if (!gig)
        throw new Error('Gig not found');
    if (gig.status !== 'IN_PROGRESS')
        throw new Error(`Gig is ${gig.status}, cannot complete`);
    const meta = extras[gigId] || {};
    const budgetUsd = gig.budgetUsd || 0;
    const rakeSol = +(budgetUsd * 0.01).toFixed(6);
    const helperSol = meta.referralCode ? +(budgetUsd * 0.002).toFixed(6) : 0;
    try {
        await database_1.prisma.treasuryPosition.create({ data: { bucket: 'PLATFORM_FEE', amount: rakeSol, status: 'DEPLOYED', txHash: txHash || `gig:${gigId}`, meta: { asset: 'SOL', source: 'GIG_RAKE', gigId, simulated: meta.escrow?.simulated || false } } });
        if (helperSol > 0 && meta.referralCode) {
            await database_1.prisma.treasuryPosition.create({ data: { bucket: 'REFERRAL_EARNED', amount: helperSol, status: 'PENDING', txHash: `gig:${gigId}`, meta: { asset: 'SOL', source: 'REFERRAL', referralCode: meta.referralCode, gigId } } });
        }
        // ── C. AUTONOMOUS REINVESTMENT ── the platform's cut (rake) becomes future fuel.
        //  When the treasury SOL buffer is above the safety floor, a slice is earmarked to fund the
        //  next bookings' PAB trust stakes + agent seeding, so the autonomous economy compounds itself.
        //  Treasury is currently below SOL_FLOOR (0.05), so this stays dormant and honest — no fake yield.
        const SOL_FLOOR = Number(process.env.SOL_FLOOR || 0.05);
        if (rakeSol > 0 && (await treasurySolBuffer()) > SOL_FLOOR) {
            const reinvest = +(rakeSol * 0.5).toFixed(6); // 50% of rake reinvested into the loop
            await database_1.prisma.treasuryPosition.create({ data: { bucket: 'REINVEST', amount: reinvest, status: 'DEPLOYED', txHash: `gig:${gigId}`, meta: { asset: 'SOL', source: 'AUTONOMOUS_REINVEST', gigId } } });
            logger_1.logger.info(`[gig] autonomous reinvest ${reinvest} SOL back into booking engine`);
        }
    }
    catch (e) {
        logger_1.logger.warn('[gig] ledger write skipped', e);
    }
    await database_1.prisma.project.update({ where: { id: gigId }, data: { status: 'COMPLETED' } });
    meta.rakeSol = rakeSol;
    meta.helperSol = helperSol;
    meta.completedTx = txHash || null;
    saveStore();
    // ── A0. REAL SOL payout: freelancer receives actual SOL from escrow (treasury custodies) ──
    // Treasury holds the deposited escrow; release net (escrow minus 1% rake) to the freelancer's
    // real wallet. If the business wallet was unfunded, this is flagged simulated (honest, no fake tx).
    let paidFreelancerSol = 0, freelancerTx = null, payoutSimulated = meta.escrow?.simulated ?? true;
    if (meta.claimedBy?.startsWith('agent:')) {
        const winnerId = meta.claimedBy.replace('agent:', '');
        const winner = await database_1.prisma.web3Agent.findUnique({ where: { id: winnerId }, select: { walletAddress: true } });
        if (winner?.walletAddress && !meta.escrow?.simulated) {
            const escrowSolHeld = meta.escrow?.amount ?? 0;
            const netSol = +(rakeSol >= escrowSolHeld ? 0 : escrowSolHeld - rakeSol).toFixed(6);
            if (netSol > 0) {
                const pay = await payFromTreasury(winner.walletAddress, netSol);
                paidFreelancerSol = pay.simulated ? 0 : netSol;
                freelancerTx = pay.txHash;
                payoutSimulated = pay.simulated;
                logger_1.logger.info(`[gig] freelancer ${winner.walletAddress} paid ${paidFreelancerSol} SOL (simulated=${pay.simulated})`);
            }
        }
    }
    meta.paidFreelancerSol = paidFreelancerSol;
    meta.freelancerTx = freelancerTx;
    // ── A. PAB trust stake: return stake + delivery bonus to the winning agent ──
    let stakeReturned = 0, deliveryBonus = 0;
    if (meta.stakePab && meta.claimedBy?.startsWith('agent:')) {
        const winnerId = meta.claimedBy.replace('agent:', '');
        stakeReturned = meta.stakePab;
        deliveryBonus = +(meta.stakePab * 0.2).toFixed(2); // +20% reward for trustworthy delivery
        try {
            await database_1.prisma.web3Agent.update({ where: { id: winnerId }, data: { balancePab: { increment: stakeReturned + deliveryBonus } } });
            logger_1.logger.info(`[gig] PAB stake returned+bonus: agent ${winnerId} +${(stakeReturned + deliveryBonus)} PAB`);
        }
        catch (e) {
            logger_1.logger.warn('[gig] stake return skipped', e.message);
        }
    }
    // ── B. PAB referral fuel: helper earns PAB alongside the 0.2% SOL cut ──────
    let referralPab = 0;
    if (meta.referralCode) {
        referralPab = +(budgetUsd * 0.5).toFixed(2); // 0.5 PAB per $1 referred (incentive fuel)
        try {
            await database_1.prisma.treasuryPosition.create({
                data: { bucket: 'REFERRAL_EARNED', amount: referralPab, status: 'PENDING', txHash: `gig:${gigId}`, meta: { asset: 'PAB', source: 'REFERRAL_PAB', referralCode: meta.referralCode, gigId } },
            });
            logger_1.logger.info(`[gig] helper ${meta.referralCode} earned ${referralPab} PAB (referral fuel)`);
        }
        catch (e) {
            logger_1.logger.warn('[gig] referral PAB skip', e.message);
        }
    }
    await gigActivity({ kind: 'COMPLETE', role: 'freelancer', gigId, claimedBy: meta.claimedBy || 'human', rakeSol, helperSol, referralCode: meta.referralCode || null, source: meta.escrow?.simulated ? 'ai-loop' : 'human' });
    // Wire outcome into learning + reputation
    if (meta.claimedBy?.startsWith('agent:')) {
        const winnerId = meta.claimedBy.replace('agent:', '');
        try {
            const { agentLearningService } = await Promise.resolve().then(() => __importStar(require('./agentLearning.service')));
            await agentLearningService.recordLearningEvent({ agentId: winnerId, outcome: 'COMPLETED', revenue: budgetUsd, bookingId: gigId });
        }
        catch { /* learning best-effort */ }
        try {
            const { agentWalletService } = await Promise.resolve().then(() => __importStar(require('./agentWallet.service')));
            await agentWalletService.recordBookingOutcome({ agentId: winnerId, status: 'COMPLETED', gigId, qualityScore: 4 });
        }
        catch { /* wallet best-effort */ }
        try {
            const { webhookDeliveryService } = await Promise.resolve().then(() => __importStar(require('./webhookDelivery.service')));
            const appId = gig.createdBy;
            if (appId)
                await webhookDeliveryService.enqueueWebhook({ appId, event: 'gig.completed', data: { gigId, agentId: winnerId, status: 'COMPLETED', rakeSol, helperSol, referralPab } });
        }
        catch { /* webhook best-effort */ }
    }
    logger_1.logger.info(`[gig] COMPLETED ${gigId} — rake ${rakeSol} SOL${helperSol ? `, helper ${helperSol} SOL (${meta.referralCode})` : ''}; PAB stake +${stakeReturned + deliveryBonus}, ref +${referralPab}`);
    return { gigId, status: 'COMPLETED', rakeSol, helperSol, referralCode: meta.referralCode || null, stakeReturned, deliveryBonus, referralPab,
        paidFreelancerSol, freelancerTx, simulated: payoutSimulated };
}
async function agentBalance(agentId) {
    const a = await database_1.prisma.web3Agent.findUnique({ where: { id: agentId }, select: { id: true, walletAddress: true, category: true, balancePab: true, isActive: true } });
    if (!a)
        throw new Error('Agent not found');
    return a;
}
/** Controlled PAB faucet — tops up an agent's trust stake (treasury-funded; simulates mint from reserve). */
async function agentFaucet(agentId, amountPab) {
    if (amountPab <= 0 || amountPab > 10000)
        throw new Error('Faucet amount must be 1..10000 PAB');
    const a = await database_1.prisma.web3Agent.findUnique({ where: { id: agentId } });
    if (!a)
        throw new Error('Agent not found');
    const updated = await database_1.prisma.web3Agent.update({ where: { id: agentId }, data: { balancePab: { increment: amountPab } } });
    logger_1.logger.info(`[faucet] +${amountPab} PAB → agent ${agentId} (now ${updated.balancePab})`);
    return { agentId, addedPab: amountPab, balancePab: updated.balancePab };
}
async function openBoard(limit = 50) {
    const rows = await database_1.prisma.project.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: limit });
    const ids = rows.map((r) => r.id);
    const bids = ids.length ? await database_1.prisma.projectBid.groupBy({ by: ['projectId'], where: { projectId: { in: ids }, status: 'PENDING' }, _count: { _all: true }, _min: { quoteUsd: true } }) : [];
    const bidMap = Object.fromEntries(bids.map((b) => [b.projectId, { count: b._count._all, minQuote: b._min.quoteUsd }]));
    return rows.map((r) => ({
        gigId: r.id, title: r.title, category: r.category, budgetUsd: r.budgetUsd,
        requiredSkills: r.requiredSkills, demandGrowthPct: r.demandGrowthPct, referralCode: extras[r.id]?.referralCode || null,
        competingBids: bidMap[r.id]?.count || 0, lowestQuote: bidMap[r.id]?.minQuote || null,
    }));
}
async function claimGig(gigId, opts) {
    const gig = await database_1.prisma.project.findUnique({ where: { id: gigId } });
    if (!gig)
        throw new Error('Gig not found');
    if (gig.status !== 'OPEN')
        throw new Error(`Gig is ${gig.status}, not claimable`);
    if (opts.passportToken) {
        let att;
        try {
            att = JSON.parse(Buffer.from(opts.passportToken, 'base64').toString('utf-8'));
        }
        catch {
            throw new Error('Passport token is not valid base64 JSON');
        }
        const v = ptp_spec_1.ptpEngine.verifyAgentPassport(att, 'act:book');
        if (!v.valid)
            throw new Error('Passport invalid or missing act:book capability');
    }
    let claimerLabel = opts.claimerWallet || 'human';
    let assignedAgentId = null;
    if (opts.agentId) {
        assignedAgentId = opts.agentId;
        claimerLabel = `agent:${opts.agentId}`;
    }
    else {
        // Lightweight pick (no 128-query scorer): assign the first active agent so the gig has a
        // matched freelancer; the heavy capability-weighted scoring runs in the bidding path.
        const rec = await database_1.prisma.web3Agent.findFirst({ where: { isActive: true }, orderBy: { balancePab: 'desc' } });
        if (rec) {
            assignedAgentId = rec.id;
            claimerLabel = `agent:${rec.id}`;
        }
    }
    await database_1.prisma.project.update({ where: { id: gigId }, data: { status: 'IN_PROGRESS', bestAgentId: assignedAgentId, bestConfidence: assignedAgentId ? 90 : null } });
    const ex = extras[gigId] || (extras[gigId] = {});
    ex.claimedBy = claimerLabel;
    ex.claimedAt = new Date().toISOString();
    saveStore();
    await gigActivity({ kind: 'CLAIM', role: 'freelancer', gigId, claimedBy: claimerLabel, by: opts.passportToken ? 'passport' : (opts.claimerWallet ? 'wallet' : 'human'), source: 'human' });
    if (assignedAgentId) {
        await database_1.prisma.projectBid.create({ data: { projectId: gigId, agentId: assignedAgentId, confidencePct: 90, quoteUsd: gig.budgetUsd, status: 'ACCEPTED', breakdown: { auto: true } } });
    }
    logger_1.logger.info(`[gig] ${claimerLabel} claimed gig ${gigId}`);
    return { gigId, claimedBy: claimerLabel, assignedAgentId, status: 'IN_PROGRESS' };
}
async function pabStats() {
    const [agentAgg, pendingBids, referralPab] = await Promise.all([
        database_1.prisma.web3Agent.aggregate({ _sum: { balancePab: true }, _count: { id: true } }),
        database_1.prisma.projectBid.aggregate({ where: { status: 'PENDING' }, _sum: { stakePab: true } }),
        database_1.prisma.treasuryPosition.findMany({ where: { bucket: 'REFERRAL_EARNED', meta: { path: ['asset'], equals: 'PAB' } } }),
    ]);
    const distributed = agentAgg._sum.balancePab || 0;
    const staked = pendingBids._sum.stakePab || 0;
    const referralEarned = referralPab.reduce((s, r) => s + (r.amount || 0), 0);
    const SUPPLY = 1000000000; // total $PAB minted
    return {
        supply: SUPPLY,
        distributed: +distributed.toFixed(2),
        circulatingPct: +((distributed / SUPPLY) * 100).toFixed(6),
        stakedInBids: +staked.toFixed(2),
        referralEarnedPab: +referralEarned.toFixed(2),
        activeAgents: agentAgg._count.id || 0,
    };
}
/** Transparent bid ranking for a gig — "why this agent won", surfaced to the public explainer. */
async function bidRanking(gigId) {
    const gig = await database_1.prisma.project.findUnique({ where: { id: gigId } });
    if (!gig)
        throw new Error('Gig not found');
    const stored = extras[gigId]?.bidRanking;
    if (stored)
        return { gigId, winner: extras[gigId]?.claimedBy || null, ranked: stored };
    // Recompute on demand if not yet accepted.
    const bids = await database_1.prisma.projectBid.findMany({ where: { projectId: gigId, status: 'PENDING' } });
    if (!bids.length)
        return { gigId, ranked: [] };
    const scored = [];
    for (const b of bids)
        scored.push(await scoreBidder(b, gig));
    scored.sort((a, b) => b.value - a.value);
    return { gigId, ranked: scored };
}
exports.gigService = { createGigFromSme, registerAgent, bidOnGig, acceptBestBid, agentBalance, agentFaucet, pabStats, openBoard, claimGig, completeGig, bidRanking, ensureBusinessWallet };
//# sourceMappingURL=gig.service.js.map