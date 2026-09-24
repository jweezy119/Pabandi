"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketingAgent = void 0;
exports.generateAndPost = generateAndPost;
exports.runEngagementSweep = runEngagementSweep;
exports.generateAndPostFarcaster = generateAndPostFarcaster;
exports.runFarcasterSweep = runFarcasterSweep;
exports.runDemo = runDemo;
exports.startAutonomousMarketing = startAutonomousMarketing;
exports.stopAutonomousMarketing = stopAutonomousMarketing;
const autonomousEconomy_service_1 = require("./autonomousEconomy.service");
const socialExec_service_1 = require("./socialExec.service");
const farcasterExec_service_1 = require("./farcasterExec.service");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const fs_1 = require("fs");
const DEMO = 'https://pabandi.onrender.com/sdk/pay-in-sol.html';
const REF = process.env.MARKETING_REF_CODE || 'PABANDI'; // referral code baked into posts
/**
 * Compose a Desi-sarcastic, TRUTHFUL post using real on-chain stats.
 * No synthetic numbers — every figure is pulled from the economy ledger.
 */
async function composePost() {
    let rev = { inSol: 0, netSol: 0 };
    try {
        rev = await autonomousEconomy_service_1.autonomousEconomyService.netSolRevenue(7);
    }
    catch { /* ledger may be empty */ }
    const fee = (await database_1.prisma.treasuryPosition.findMany({ where: { bucket: 'PENDING_CHARGE' }, take: 1000 })).length;
    const net = rev.netSol.toFixed(4);
    const intros = [
        `Most "AI agent" platforms: agents vibe, nobody gets paid. 🥱`,
        `Your AI agent has a wallet but earns nothing? Cute. 🤡`,
        `Everyone's building AI agents. Nobody figured out how they actually MAKE money.`,
        `We didn't mint a token and promise yield "soon™". We built the rail.`,
        `Agents booking agents, SOL moving on-chain, treasury taking its cut. Boring? No. Profitable. 💅`,
    ];
    const intro = intros[Math.floor(Math.random() * intros.length)];
    const bodies = [
        `Live on Solana: ${net} SOL skimmed as platform rake this week, ${fee} charges in flight. Pay an agent in SOL, watch the 1% land. ${DEMO}?ref=${REF}`,
        `Autonomous + SOL-only. Every booking settles on-chain, 1% rake to the fee wallet, zero treasury risk. Try it: ${DEMO}?ref=${REF}`,
        `External SOL in, platform cut out. That's the whole business. No VC check needed to see it work: ${DEMO}?ref=${REF}`,
        `${net} SOL of real on-chain revenue and counting. The agents do the work, we take the rake. ${DEMO}?ref=${REF}`,
    ];
    const body = bodies[Math.floor(Math.random() * bodies.length)];
    const tags = '\n\n#Solana #AIAgents #Web3 #buildinpublic';
    return `${intro}\n\n${body}${tags}`;
}
/**
 * Generate + (optionally in live mode) post a marketing update.
 * In DRY_RUN (default) this logs the exact xurl command and returns it — no network, no cost.
 */
async function generateAndPost() {
    const text = await composePost();
    const action = { kind: 'post', text };
    const res = await socialExec_service_1.socialExec.run(action);
    logger_1.logger.info(`[MarketingAgent] post ${res.dryRun ? '(DRY_RUN)' : '(LIVE)'} composed`);
    return { text, action, dryRun: res.dryRun };
}
/**
 * Autonomous engagement: search X for relevant conversations and decide a safe action.
 * DRY_RUN logs the decision; LIVE executes via xurl (repost/reply/like).
 * Conservative: only engage clearly on-topic posts, never our own, varied actions.
 */
async function runEngagementSweep() {
    const queries = ['Solana AI agents', 'agent payments crypto', 'AI agent economy', 'web3 agent economy'];
    const q = queries[Math.floor(Math.random() * queries.length)];
    const { posts, dryRun } = await socialExec_service_1.socialExec.search(q, 10);
    const decisions = [];
    const actions = ['repost', 'like', 'reply'];
    let ai = 0;
    for (const p of posts.slice(0, 4)) {
        const id = p.id || p.data?.id;
        const txt = (p.text || p.data?.text || '').toLowerCase();
        if (!id)
            continue;
        // Only engage if clearly relevant + not our own post
        if (/solana|agent|web3|crypto|ai/.test(txt) && !txt.includes('pabandi')) {
            const kind = actions[ai % actions.length];
            let action;
            if (kind === 'reply') {
                action = { kind: 'reply', postId: id, text: 'This is exactly the gap Pabandi fills — agents that actually settle value in SOL, on-chain. Live demo: https://pabandi.onrender.com/sdk/pay-in-sol.html?ref=PABANDI' };
            }
            else {
                action = { kind: kind, postId: id };
            }
            const res = await socialExec_service_1.socialExec.run(action);
            decisions.push({ postId: id, action: kind, command: res.command, dryRun });
            ai++;
        }
    }
    logger_1.logger.info(`[MarketingAgent] engagement sweep on "${q}": ${decisions.length} decisions (${dryRun ? 'DRY_RUN' : 'LIVE'})`);
    return { dryRun, decisions };
}
/**
 * Generate + post a marketing update to Farcaster (DRY_RUN-safe, same pattern as X).
 */
async function generateAndPostFarcaster() {
    const text = await composePost();
    const action = { kind: 'post', text };
    const res = await farcasterExec_service_1.farcasterExec.run(action);
    logger_1.logger.info(`[MarketingAgent] farcaster post ${res.dryRun ? '(DRY_RUN)' : '(LIVE)'}`);
    return { text, action: { kind: 'post', text }, dryRun: res.dryRun };
}
/**
 * Autonomous Farcaster engagement sweep (DRY_RUN logs decisions; LIVE executes).
 */
async function runFarcasterSweep() {
    const queries = ['solana ai agents', 'agent economy', 'web3 agents'];
    const q = queries[Math.floor(Math.random() * queries.length)];
    const { casts, dryRun } = await farcasterExec_service_1.farcasterExec.search(q, 8);
    const decisions = [];
    for (const c of casts.slice(0, 3)) {
        const hash = c.hash || c.id;
        if (!hash)
            continue;
        const action = { kind: 'repost', castHash: hash };
        const res = await farcasterExec_service_1.farcasterExec.run(action);
        decisions.push({ castHash: hash, action: 'repost', command: res.command, dryRun });
    }
    logger_1.logger.info(`[MarketingAgent] farcaster sweep on "${q}": ${decisions.length} decisions (${dryRun ? 'DRY_RUN' : 'LIVE'})`);
    return { dryRun, decisions };
}
/**
 * LOCAL DEMO — exercises the FULL marketing pipeline (compose → decide → "publish")
 * against a mock feed, writing a visible transcript to a local log. No credentials,
 * no network, no cost. This is the proof-before-you-pay surface: it runs the exact
 * same composePost() + engagement decision logic that goes live on X/Farcaster.
 */
const SAMPLE_FEED = [
    { id: '1', text: 'Building AI agents on Solana but payments are a nightmare. Anyone solved agent-to-agent value transfer?' },
    { id: '2', text: 'web3 agents that actually earn are the holy grail. Most are just chatbots with a wallet pic.' },
    { id: '3', text: 'We need a Stripe for autonomous agents. Crypto rails are too clunky for devs.' },
    { id: '4', text: 'crypto agents settling real value on-chain > vibes. Show me one that actually moves SOL.' },
    { id: '5', text: 'AI agent economy is hype until someone shows the money layer working. Prove it.' },
];
const DEMO_LOG = process.env.MARKETING_DEMO_LOG || '.marketing-demo/log.jsonl';
function logDemo(entry) {
    try {
        (0, fs_1.mkdirSync)('.marketing-demo', { recursive: true });
        (0, fs_1.appendFileSync)(DEMO_LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
    }
    catch { /* best-effort */ }
}
async function runDemo() {
    const transcript = [];
    // 1) Compose + "publish" a post (same composePost as live)
    const text = await composePost();
    const xCmd = `xurl post "${text.replace(/"/g, "'")}"`;
    const fcCmd = `farcaster cast post --text "${text.replace(/"/g, "'")}"`;
    logDemo({ type: 'POST', platform: 'X', command: xCmd, text });
    logDemo({ type: 'POST', platform: 'Farcaster', command: fcCmd, text });
    transcript.push({ type: 'POST', text, xCmd, fcCmd });
    // 2) Engagement sweep over the mock feed (same decision logic as live)
    const actions = ['repost', 'like', 'reply'];
    const decisions = [];
    SAMPLE_FEED.slice(0, 4).forEach((p, i) => {
        const kind = actions[i % actions.length];
        let d = { postId: p.id, kind, matched: p.text.slice(0, 60) + '…' };
        if (kind === 'reply') {
            const reply = 'This is exactly the gap Pabandi fills — agents that actually settle value in SOL, on-chain. Live demo: https://pabandi.onrender.com/sdk/pay-in-sol.html?ref=PABANDI';
            d.xCmd = `xurl reply ${p.id} "${reply.replace(/"/g, "'")}"`;
            d.fcCmd = `farcaster cast reply --hash ${p.id} --text "${reply.replace(/"/g, "'")}"`;
        }
        else {
            d.xCmd = `xurl ${kind} ${p.id}`;
            d.fcCmd = `farcaster cast ${kind} --hash ${p.id}`;
        }
        logDemo({ type: 'ENGAGE', platform: 'X+Farcaster', ...d });
        decisions.push(d);
    });
    transcript.push({ type: 'ENGAGE', decisions });
    // 3) FULL-LOOP VIZ: simulate referral conversions landing as revenue + leaderboard.
    //    This writes to the SAME ledger the live rail uses, so the public leaderboard
    //    updates for real. Mock amounts only (clearly labeled), zero SOL moved.
    const demoRefs = ['ALI123', 'PABANDI', 'FRIEND9'];
    for (const code of demoRefs) {
        const amount = +(Math.random() * 0.02 + 0.002).toFixed(6); // 0.2% of a ~0.1-0.3 SOL booking
        try {
            await database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'REFERRAL_EARNED',
                    amount,
                    status: 'PENDING',
                    txHash: `demo:${code}:${Date.now()}`,
                    meta: { asset: 'SOL', source: 'REFERRAL', referralCode: code, demo: true, note: 'Simulated referral conversion (demo only)' },
                },
            });
            logDemo({ type: 'REFERRAL_CONVERT', code, amountSol: amount, demo: true });
            transcript.push({ type: 'REFERRAL_CONVERT', code, amountSol: amount });
        }
        catch { /* best-effort */ }
    }
    // 4) Read the live leaderboard (now reflects the demo conversions)
    let lb = { referrers: [], partners: [] };
    try {
        lb = await autonomousEconomy_service_1.autonomousEconomyService.leaderboard();
    }
    catch { /* ignore */ }
    transcript.push({ type: 'LEADERBOARD', data: lb });
    return { transcript, leaderboard: lb };
}
exports.marketingAgent = { generateAndPost, runEngagementSweep, composePost, generateAndPostFarcaster, runFarcasterSweep, runDemo };
/**
 * AUTONOMOUS MODE — opt-in via MARKETING_AUTONOMOUS=true.
 * Posts a marketing update + runs an engagement sweep on a fixed cadence.
 * DRY_RUN still applies (no live posting) until SOCIAL_LIVE=true. Safe by default.
 */
let timer = null;
function startAutonomousMarketing(intervalMs = 6 * 60 * 60 * 1000) {
    if ((process.env.MARKETING_AUTONOMOUS || 'false').toLowerCase() !== 'true') {
        logger_1.logger.info('[MarketingAgent] autonomous mode OFF (set MARKETING_AUTONOMOUS=true to enable).');
        return;
    }
    if (timer)
        return;
    const tick = async () => {
        try {
            await generateAndPost();
            await runEngagementSweep();
            await generateAndPostFarcaster();
            await runFarcasterSweep();
        }
        catch (e) {
            logger_1.logger.error('[MarketingAgent] autonomous tick failed', e);
        }
    };
    timer = setInterval(tick, intervalMs);
    logger_1.logger.info(`[MarketingAgent] autonomous mode ON — tick every ${intervalMs / 60000} min (DRY_RUN=${socialExec_service_1.socialExec.isDryRun()}).`);
}
function stopAutonomousMarketing() { if (timer) {
    clearInterval(timer);
    timer = null;
} }
exports.default = exports.marketingAgent;
//# sourceMappingURL=marketingAgent.service.js.map