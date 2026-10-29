import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { OpenAIProvider } from './ai/openai.provider';
import { jevDecision } from './jevDecision.service';
import { sendEmail } from './email.service';

export interface ScoutTarget {
  id: string;
  name: string;
  email?: string;
  website?: string;
  agentType: 'data-broker' | 'ai-agent-builder' | 'marketplace';
  trustScore?: number;
  source: string;
}

export interface ResearchResult {
  summary: string;
  pitchHook: string;
  readmeContent?: string;
}

const GITHUB_API = 'https://api.github.com';

export class ScoutAgentService {
  private openai: OpenAIProvider | null = null;

  constructor() {
    try {
      this.openai = new OpenAIProvider();
    } catch {
      this.openai = null;
    }
  }

  // ── COMMIT 1: Discovery ──────────────────────────────────────────

  async discoverTargets(): Promise<ScoutTarget[]> {
    const targets: ScoutTarget[] = [];

    try {
      const githubTargets = await this.discoverFromGitHub();
      targets.push(...githubTargets);
      logger.info(`[Scout] GitHub discovery: ${githubTargets.length} targets`);
    } catch (err) {
      logger.error(`[Scout] GitHub discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const phTargets = await this.discoverFromProductHunt();
      targets.push(...phTargets);
      logger.info(`[Scout] Product Hunt discovery: ${phTargets.length} targets`);
    } catch (err) {
      logger.error(`[Scout] Product Hunt discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return targets;
  }

  private async discoverFromGitHub(): Promise<ScoutTarget[]> {
    const response = await fetch(
      `${GITHUB_API}/search/repositories?q=topic:ai-agent+topic:langchain&sort=updated&order=desc&per_page=20`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Pabandi-Scout/1.0',
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
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
      updated_at: string;
    }> = data.items ?? [];

    const targets: ScoutTarget[] = [];

    for (const repo of items) {
      let email: string | undefined;

      // Try to fetch owner email from GitHub user API
      try {
        const userResp = await fetch(`${GITHUB_API}/users/${repo.owner.login}`, {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Pabandi-Scout/1.0',
            ...(process.env.GITHUB_TOKEN
              ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
              : {}),
          },
        });

        if (userResp.ok) {
          const userData = await userResp.json();
          if (userData.email) {
            email = userData.email;
          }
        }
      } catch {
        // Email not available, continue without it
      }

      targets.push({
        id: `gh:${repo.id}`,
        name: repo.full_name,
        email,
        website: repo.html_url,
        agentType: 'data-broker',
        source: 'github',
      });
    }

    return targets;
  }

  private async discoverFromProductHunt(): Promise<ScoutTarget[]> {
    const phToken = process.env.PRODUCT_HUNT_API_KEY;
    if (!phToken) {
      logger.warn(
        '[Scout] PRODUCT_HUNT_API_KEY not set, skipping Product Hunt discovery'
      );
      return [];
    }

    const query = `{
      posts(postedAfter: "2024-01-01T00:00:00Z", first: 10, order: VOTES_DESC) {
        edges {
          node {
            id
            name
            tagline
            description
            website
            topics { edges { node { name } } }
          }
        }
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

    if (!response.ok) {
      throw new Error(`Product Hunt API: ${response.status}`);
    }

    const data = await response.json();
    const posts = data.data?.posts?.edges ?? [];

    return posts.map((edge: any) => {
      const node = edge.node;
      return {
        id: `ph:${node.id}`,
        name: node.name,
        website: node.website,
        agentType: 'ai-agent-builder',
        source: 'producthunt',
      };
    });
  }

  // ── COMMIT 1: Research ───────────────────────────────────────────

  async researchTarget(target: ScoutTarget): Promise<ResearchResult> {
    let readmeContent: string | undefined;

    if (target.source === 'github' && target.website) {
      try {
        readmeContent = await this.fetchGitHubReadme(target.website);
      } catch (err) {
        logger.warn(
          `[Scout] README fetch failed for ${target.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const sourceText = readmeContent ?? target.name;
    const { summary, pitchHook } = await this.generateResearch(
      sourceText,
      target.name
    );

    return {
      summary,
      pitchHook,
      readmeContent,
    };
  }

  private async fetchGitHubReadme(repoUrl: string): Promise<string> {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error('Invalid GitHub URL');

    const [, owner, repo] = match;
    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/readme`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Pabandi-Scout/1.0',
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) return '';
      throw new Error(`GitHub README: ${response.status}`);
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return content.slice(0, 4000);
  }

  private async generateResearch(
    sourceText: string,
    agentName: string
  ): Promise<{ summary: string; pitchHook: string }> {
    const prompt = `You are researching an AI agent for Pabandi outreach. Based ONLY on the following source text, provide:
1. A 2-sentence summary of what this agent does (no hallucination, only what is in the text)
2. A personalized pitch hook (1 sentence) about monetizing their data through Pabandi escrow

Source text:
${sourceText}

Agent name: ${agentName}

Respond in this exact format:
SUMMARY: <2 sentences>
PITCH: <1 sentence>`;

    if (this.openai && this.openai.isConfigured()) {
      try {
        const result = await this.openai.complete(
          [
            {
              role: 'system',
              content:
                'You are a research assistant for Pabandi. Be concise, factual, and never hallucinate.',
            },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.3, maxTokens: 500 }
        );

        return this.parseResearchResponse(result.text);
      } catch (err) {
        logger.warn(
          `[Scout] OpenAI research failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Fallback to Jev
    try {
      const answers = await jevDecision.decide(
        { agentName, sourceText },
        {
          summary: {
            type: 'noul',
            instructions:
              'Summarize what this AI agent does in 2 sentences based only on the source text. Do not hallucinate.',
          },
          pitchHook: {
            type: 'noul',
            instructions:
              'Write a personalized 1-sentence pitch hook about monetizing this agent data through Pabandi escrow.',
          },
        }
      );

      return {
        summary:
          answers?.summary?.noul != null && answers.summary.noul > 0.5
            ? 'AI agent discovered via discovery source'
            : 'AI agent',
        pitchHook:
          answers?.pitchHook?.noul != null && answers.pitchHook.noul > 0.5
            ? 'Monetize your data through Pabandi escrow'
            : 'Monetize your data through Pabandi',
      };
    } catch (err) {
      logger.warn(
        `[Scout] Jev research failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return {
        summary: 'AI agent discovered via discovery source',
        pitchHook: 'Monetize your data through Pabandi',
      };
    }
  }

  private parseResearchResponse(text: string): {
    summary: string;
    pitchHook: string;
  } {
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=PITCH:|$)/);
    const pitchMatch = text.match(/PITCH:\s*([\s\S]*?)$/);

    return {
      summary: summaryMatch?.[1]?.trim() || 'AI agent discovered via discovery source',
      pitchHook:
        pitchMatch?.[1]?.trim() || 'Monetize your data through Pabandi escrow',
    };
  }

  // ── COMMIT 2: Outreach ───────────────────────────────────────────

  async outreachTarget(
    target: ScoutTarget,
    pitch: string
  ): Promise<{ sent: boolean; error?: string }> {
    if (!target.email) {
      return { sent: false, error: 'No email address' };
    }

    const referralLink = await this.generateReferralLink(target);

    const subject = `Monetizing your AI agent ${target.name}`;
    const html = `
      <p>Hey ${target.name.split(' ')[0] || 'there'},</p>
      <p>${pitch}</p>
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

  private async generateReferralLink(target: ScoutTarget): Promise<string> {
    const referral = await prisma.pabReferral.create({
      data: {
        referrerId: 'pabandi-scout',
        refereeId: target.id,
        refereeEmail: target.email,
        status: 'PENDING',
        metadata: JSON.stringify({ targetId: target.id, source: target.source }),
      },
    });

    return `${process.env.APP_URL || 'https://pabandi.com'}/agent-onboarding?ref=${referral.id}`;
  }

  async mcpOutreach(
    target: ScoutTarget,
    pitch: string
  ): Promise<{ sent: boolean; error?: string }> {
    logger.info(
      `[Scout] MCP outreach to ${target.name}: ${pitch.slice(0, 50)}...`
    );
    return { sent: false, error: 'MCP outreach not yet implemented for this target' };
  }
}

export const scoutAgent = new ScoutAgentService();
