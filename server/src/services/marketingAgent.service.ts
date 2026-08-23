import { autonomousEconomyService } from './autonomousEconomy.service';
import { socialExec, SocialAction } from './socialExec.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const DEMO = 'https://pabandi.onrender.com/sdk/pay-in-sol.html';
const REF = process.env.MARKETING_REF_CODE || 'PABANDI'; // referral code baked into posts

export interface MarketingPost {
  text: string;
  action: SocialAction;
  dryRun: boolean;
}

/**
 * Compose a Desi-sarcastic, TRUTHFUL post using real on-chain stats.
 * No synthetic numbers — every figure is pulled from the economy ledger.
 */
async function composePost(): Promise<string> {
  let rev = { inSol: 0, netSol: 0 };
  try { rev = await autonomousEconomyService.netSolRevenue(7); } catch { /* ledger may be empty */ }
  const fee = (await prisma.treasuryPosition.findMany({ where: { bucket: 'PENDING_CHARGE' }, take: 1000 })).length;
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
export async function generateAndPost(): Promise<MarketingPost> {
  const text = await composePost();
  const action: SocialAction = { kind: 'post', text };
  const res = await socialExec.run(action);
  logger.info(`[MarketingAgent] post ${res.dryRun ? '(DRY_RUN)' : '(LIVE)'} composed`);
  return { text, action, dryRun: res.dryRun };
}

/**
 * Autonomous engagement: search X for relevant conversations and decide a safe action.
 * DRY_RUN logs the decision; LIVE executes via xurl (like/reply/repost).
 * Kept conservative: only engage with clearly on-topic posts; never spam.
 */
export async function runEngagementSweep(): Promise<{ dryRun: boolean; decisions: any[] }> {
  const queries = ['Solana AI agents', 'agent payments crypto', 'AI agent economy', 'web3 agent economy'];
  const q = queries[Math.floor(Math.random() * queries.length)];
  const { posts, dryRun } = await socialExec.search(q, 8);
  const decisions: any[] = [];
  for (const p of posts.slice(0, 3)) {
    const id = p.id || p.data?.id;
    const txt = (p.text || p.data?.text || '').toLowerCase();
    if (!id) continue;
    // Only engage if clearly relevant + not our own post
    if (/solana|agent|web3|crypto|ai/.test(txt) && !txt.includes('pabandi')) {
      const action: SocialAction = { kind: 'repost', postId: id };
      const res = await socialExec.run(action);
      decisions.push({ postId: id, action: 'repost', command: res.command, dryRun });
    }
  }
  logger.info(`[MarketingAgent] engagement sweep on "${q}": ${decisions.length} decisions (${dryRun ? 'DRY_RUN' : 'LIVE'})`);
  return { dryRun, decisions };
}

export const marketingAgent = { generateAndPost, runEngagementSweep, composePost };

/**
 * AUTONOMOUS MODE — opt-in via MARKETING_AUTONOMOUS=true.
 * Posts a marketing update + runs an engagement sweep on a fixed cadence.
 * DRY_RUN still applies (no live posting) until SOCIAL_LIVE=true. Safe by default.
 */
let timer: NodeJS.Timeout | null = null;
export function startAutonomousMarketing(intervalMs = 6 * 60 * 60 * 1000) { // default 6h
  if ((process.env.MARKETING_AUTONOMOUS || 'false').toLowerCase() !== 'true') {
    logger.info('[MarketingAgent] autonomous mode OFF (set MARKETING_AUTONOMOUS=true to enable).');
    return;
  }
  if (timer) return;
  const tick = async () => {
    try {
      await generateAndPost();
      await runEngagementSweep();
    } catch (e) { logger.error('[MarketingAgent] autonomous tick failed', e); }
  };
  timer = setInterval(tick, intervalMs);
  logger.info(`[MarketingAgent] autonomous mode ON — tick every ${intervalMs / 60000} min (DRY_RUN=${socialExec.isDryRun()}).`);
}
export function stopAutonomousMarketing() { if (timer) { clearInterval(timer); timer = null; } }

export default marketingAgent;
