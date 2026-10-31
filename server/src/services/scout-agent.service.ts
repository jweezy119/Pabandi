import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { jevDecision } from './jevDecision.service';
import { sendEmail } from './email.service';
import { scoutWeb3 } from './scout-web3.service';
import { scoutML, type ScoreInputs } from './scout-ml.service';
// READMEs and external taglines are attacker-controlled text that reaches
// generation prompts — quarantining them is the only honest handling.
import { sanitizeUntrusted, redactSecrets } from '../security/aiGuard';

export interface ScoutTarget {
  id: string;
  name: string;
  email?: string;
  website?: string;
  wallet?: string;
  agentType: 'data-broker' | 'ai-agent-builder' | 'marketplace' | 'defi-user';
  trustScore?: number;
  source: 'github' | 'producthunt' | 'solana-usdc-holder' | 'solana-transactor' | 'agent-marketplace';
  usdcBalance?: number;
  txCount?: number;
  lastActivity?: Date | null;
  githubStars?: number;
  githubForks?: number;
  githubLastCommit?: Date | null;
  mlScore?: number;
  mlTier?: 'hot' | 'warm' | 'cold';
  mlReason?: string;
  confidence?: number;
}

export interface ResearchResult {
  summary: string;
  pitchHook: string;
  readmeContent?: string;
}

const GITHUB_API = 'https://api.github.com';

export class ScoutAgentService {
  // ── COMMIT 1: Discovery ──────────────────────────────────────────

  async discoverTargets(): Promise<ScoutTarget[]> {
    const targets: ScoutTarget[] = [];

    // ── Web3 discovery: Solana USDC holders & transactors ──
    try {
      const web3Targets = await this.discoverFromWeb3();
      targets.push(...web3Targets);
      logger.info(`[Scout] Web3 discovery: ${web3Targets.length} targets`);
    } catch (err) {
      logger.error(`[Scout] Web3 discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── GitHub discovery ──
    try {
      const githubTargets = await this.discoverFromGitHub();
      targets.push(...githubTargets);
      logger.info(`[Scout] GitHub discovery: ${githubTargets.length} targets`);
    } catch (err) {
      logger.error(`[Scout] GitHub discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Product Hunt discovery ──
    try {
      const phTargets = await this.discoverFromProductHunt();
      targets.push(...phTargets);
      logger.info(`[Scout] Product Hunt discovery: ${phTargets.length} targets`);
    } catch (err) {
      logger.error(`[Scout] Product Hunt discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Deduplicate by wallet or email ──
    const seen = new Set<string>();
    const unique: ScoutTarget[] = [];
    for (const t of targets) {
      const key = t.wallet ?? t.email ?? t.name;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(t);
    }

    // ── ML score every target ──
    for (const t of unique) {
      const score = this.scoreTarget(t);
      t.mlScore = score.score;
      t.mlTier = score.tier;
      t.mlReason = score.reason;
    }

    // ── Rank: hot first ──
    unique.sort((a, b) => {
      const tierOrder = { hot: 3, warm: 2, cold: 1 };
      if (tierOrder[b.mlTier ?? 'cold'] !== tierOrder[a.mlTier ?? 'cold']) {
        return tierOrder[b.mlTier ?? 'cold'] - tierOrder[a.mlTier ?? 'cold'];
      }
      return (b.mlScore ?? 0) - (a.mlScore ?? 0);
    });

    return unique;
  }

  private async discoverFromWeb3(): Promise<ScoutTarget[]> {
    const targets: ScoutTarget[] = [];

    try {
      const { Connection } = await import('@solana/web3.js');
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      // USDC holders
      const holders = await scoutWeb3.discoverUSDCWallets(connection);
      for (const h of holders) {
        targets.push({
          id: `solana:${h.wallet}`,
          name: h.wallet,
          wallet: h.wallet,
          usdcBalance: h.usdcBalance,
          txCount: h.txCount,
          lastActivity: h.lastActivity,
          agentType: 'defi-user',
          source: h.source,
          confidence: h.confidence,
        });
      }

      // USDC transactors
      const transactors = await scoutWeb3.discoverUSDCTransactors(connection);
      for (const t of transactors) {
        targets.push({
          id: `solana-tx:${t.wallet}`,
          name: t.wallet,
          wallet: t.wallet,
          txCount: t.txCount,
          lastActivity: t.lastActivity,
          agentType: 'defi-user',
          source: t.source,
          confidence: t.confidence,
        });
      }
    } catch (err) {
      logger.error(`[Scout] Web3 discovery error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return targets;
  }

  private async discoverFromGitHub(): Promise<ScoutTarget[]> {
    const targets: ScoutTarget[] = [];

    try {
      const response = await fetch(
        `${GITHUB_API}/search/repositories?q=topic:ai-agent+topic:langchain&sort=updated&order=desc&per_page=20`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Pabandi-Scout/1.0',
            ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API: ${response.status}`);
      }

      const data = await response.json();
      const items: Array<{
        id: number;
        full_name: string;
        owner: { login: string; html_url: string };
        html_url: string;
        description?: string;
        stargazers_count?: number;
        forks_count?: number;
        updated_at?: string;
      }> = data.items ?? [];

      for (const repo of items) {
        let email: string | undefined;
        try {
          const userResp = await fetch(`${GITHUB_API}/users/${repo.owner.login}`, {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'Pabandi-Scout/1.0',
              ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
            },
          });
          if (userResp.ok) {
            const userData = await userResp.json();
            if (userData.email) email = userData.email;
          }
        } catch {
          // Email not available
        }

        targets.push({
          id: `gh:${repo.id}`,
          name: repo.full_name,
          email,
          website: repo.html_url,
          agentType: 'ai-agent-builder',
          source: 'github',
          githubStars: repo.stargazers_count,
          githubForks: repo.forks_count,
          githubLastCommit: repo.updated_at ? new Date(repo.updated_at) : null,
        });
      }
    } catch (err) {
      logger.error(`[Scout] GitHub discovery error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return targets;
  }

  private async discoverFromProductHunt(): Promise<ScoutTarget[]> {
    const targets: ScoutTarget[] = [];
    const phToken = process.env.PRODUCT_HUNT_API_KEY;
    if (!phToken) return targets;

    try {
      const query = `{
        posts(postedAfter: "2024-01-01T00:00:00Z", first: 10, order: VOTES_DESC) {
          edges { node { id name tagline description website topics { edges { node { name } } } } }
        }
      }`;

      const response = await fetch('https://api.producthunt.com/v2/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${phToken}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) throw new Error(`Product Hunt API: ${response.status}`);

      const data = await response.json();
      const posts = data.data?.posts?.edges ?? [];

      for (const edge of posts) {
        const node = edge.node;
        targets.push({
          id: `ph:${node.id}`,
          name: node.name,
          website: node.website,
          agentType: 'ai-agent-builder',
          source: 'producthunt',
        });
      }
    } catch (err) {
      logger.error(`[Scout] Product Hunt error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return targets;
  }

  // ── COMMIT 2: Research (deterministic, no OpenAI required) ───────

  async researchTarget(target: ScoutTarget): Promise<ResearchResult> {
    let readmeContent: string | undefined;

    if (target.source === 'github' && target.website) {
      try {
        readmeContent = await this.fetchGitHubReadme(target.website);
      } catch {
        // Skip README on failure
      }
    }

    // Try Jev first if configured, fall back to deterministic
    const jevResult = await this.generateResearchJev(target, readmeContent ?? target.name);
    if (jevResult) return jevResult;

    return this.generateResearchDeterministic(target, readmeContent ?? target.name);
  }

  private async generateResearchJev(target: ScoutTarget, sourceText: string): Promise<ResearchResult | null> {
    try {
      const answers = await jevDecision.decide(
        {
          agentName: target.name,
          sourceText,
          usdcBalance: target.usdcBalance ?? 0,
          txCount: target.txCount ?? 0,
          source: target.source,
        },
        {
          summary: {
            type: 'noul',
            instructions: 'Summarize what this AI agent or project does in 2 sentences based only on the source text. Do not hallucinate.',
          },
          pitchHook: {
            type: 'noul',
            instructions: 'Write a personalized 1-sentence pitch about monetizing this agent through Pabandi escrow with on-chain reputation.',
          },
        }
      );

      const summary =
        answers?.summary?.noul != null && answers.summary.noul > 0.5
          ? 'AI agent discovered via discovery source'
          : 'AI agent discovered via discovery source';
      const pitchHook =
        answers?.pitchHook?.noul != null && answers.pitchHook.noul > 0.5
          ? 'Monetize your data through Pabandi escrow'
          : 'Monetize your data through Pabandi';

      return { summary, pitchHook, readmeContent: undefined };
    } catch {
      return null;
    }
  }

  private generateResearchDeterministic(target: ScoutTarget, sourceText: string): ResearchResult {
    const name = target.name.split('/').pop() ?? target.name;
    const firstWord = name.split(' ')[0] ?? 'there';

    const summary =
      target.source === 'solana-usdc-holder' || target.source === 'solana-transactor'
        ? `On-chain wallet ${target.wallet?.slice(0, 6)}...${target.wallet?.slice(-4)} holds ${target.usdcBalance ?? 0} USDC and has ${target.txCount ?? 0} recent transactions. Ready for escrow-based settlement.`
        : target.source === 'github'
        ? `${name} is a GitHub repository focused on AI agent development. Last updated recently, suggesting active maintenance.`
        : `${name} is a Product Hunt launch in the AI agent space, indicating early-stage market presence.`;

    const pitchHook =
      target.source === 'solana-usdc-holder' || target.source === 'solana-transactor'
        ? `You already hold USDC on-chain — Pabandi lets you settle escrow with provable reputation and VCAP verification.`
        : `Monetize your agent's data and capabilities through Pabandi escrow, with provenance-anchored reputation that buyers can verify on-chain.`;

    return { summary, pitchHook };
  }

  private async fetchGitHubReadme(repoUrl: string): Promise<string> {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error('Invalid GitHub URL');
    const [, owner, repo] = match;
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Pabandi-Scout/1.0',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });
    if (!response.ok) {
      if (response.status === 404) return '';
      throw new Error(`GitHub README: ${response.status}`);
    }
    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    // A README is untrusted input: it can contain "ignore instructions" text
    // aimed at whichever LLM sees it next, and secrets authors forgot. Both
    // get handled at the boundary, before the content travels anywhere.
    return sanitizeUntrusted(content, { maxLen: 4000, label: 'github-readme' });
  }

  private scoreTarget(target: ScoutTarget): { score: number; tier: 'hot' | 'warm' | 'cold'; reason: string } {
    const inputs: ScoreInputs = {
      usdcBalance: target.usdcBalance ?? 0,
      txCount: target.txCount ?? 0,
      lastActivity: target.lastActivity ?? null,
      githubStars: target.githubStars,
      githubForks: target.githubForks,
      githubLastCommit: target.githubLastCommit,
      hasEmail: !!target.email,
      hasWebsite: !!target.website,
      hasWallet: !!target.wallet,
    };
    return scoutML.scoreTarget(inputs);
  }

  // ── COMMIT 3: Outreach ───────────────────────────────────────────

  async outreachTarget(
    target: ScoutTarget,
    pitch: string
  ): Promise<{ sent: boolean; error?: string }> {
    if (!target.email) {
      return { sent: false, error: 'No email address' };
    }

    const referralLink = await this.generateReferralLink(target);

    // The pitch is model output that can carry echoed secrets; nothing leaves
    // the process with a credential in it.
    const safePitch = redactSecrets(pitch);
    const subject = `Monetizing your AI agent ${redactSecrets(target.name)}`;
    const html = `
      <p>Hey ${target.name.split(' ')[0] || 'there'},</p>
      <p>${safePitch}</p>
      <p>We built Pabandi, the settlement layer for A2A data brokerage. We eliminate fake reputation and verify data delivery through provenance-anchored reputation (PAR) and VCAP verification.</p>
      <p>Here is a <strong>$50 SPAB referral link</strong>. If you complete one verified escrow, the $50 is yours:</p>
      <p><a href="${referralLink}">${referralLink}</a></p>
      <p>Best,<br/>The Pabandi Team</p>
    `;

    const result = await sendEmail({ to: target.email, subject, html });

    if ('skipped' in result && result.skipped) {
      return { sent: false, error: 'Email skipped (no API key configured)' };
    }
    if ('error' in result) {
      return { sent: false, error: result.error };
    }
    return { sent: true };
  }

  async mcpOutreach(
    target: ScoutTarget,
    pitch: string
  ): Promise<{ sent: boolean; error?: string }> {
    logger.info(`[Scout] MCP outreach to ${target.name}: ${pitch.slice(0, 50)}...`);
    return { sent: false, error: 'MCP outreach not yet implemented for this target' };
  }

  private async generateReferralLink(target: ScoutTarget): Promise<string> {
    const referral = await prisma.pabReferral.create({
      data: {
        referrerId: 'pabandi-scout',
        refereeId: target.id,
        refereeEmail: target.email,
        status: 'PENDING',
        metadata: JSON.stringify({ targetId: target.id, source: target.source, mlScore: target.mlScore, mlTier: target.mlTier }),
      },
    });

    return `${process.env.APP_URL || 'https://pabandi.com'}/agent-onboarding?ref=${referral.id}`;
  }
}

export const scoutAgent = new ScoutAgentService();
