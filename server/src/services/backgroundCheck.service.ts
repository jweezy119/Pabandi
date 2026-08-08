import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/**
 * BackgroundCheckService
 * Streamlined, reliable background screening for freelancers, service/labor providers,
 * and property managers.
 *
 * Composes REAL authoritative data sources (no mocks):
 *  - GitHub API         → freelance dev credibility (repos, followers, account age)
 *  - RDAP (Verisign)    → domain age & registrant legitimacy for business sites
 *  - GDELT             → global news index (scam / fraud / lawsuit mentions)
 *  - HIBP              → credential breach detection (requires free API key)
 *  - OFAC SDN          → US Treasury sanctions list (server-side fetch)
 *  - Companies House   → UK company registry (requires free API key)
 *  - OSINT engines     → existing threatFusion / temporalDeception / adversarialGraph
 *
 * Risk model: weighted module scores (0-100, higher = riskier) → composite → band → recommendation.
 */

const HIBP_API_KEY = process.env.HIBP_API_KEY;
const COMPANIES_HOUSE_KEY = process.env.COMPANIES_HOUSE_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // optional, raises rate limit

export interface CheckRequest {
  subjectType: 'FREELANCER' | 'PROPERTY_MANAGER' | 'BUSINESS' | 'GUEST';
  subjectName: string;
  subjectId?: string;
  subjectEmail?: string;
  subjectPhone?: string;
  subjectWallet?: string;
  subjectGithub?: string;
  subjectWebsite?: string;
  subjectCompany?: string;
  requestedBy?: string;
  trigger?: 'MANUAL' | 'PRE_BOOKING' | 'RECURRING' | 'BATCH';
  webhookUrl?: string;
}

export interface ModuleResult {
  source: string;
  riskScore: number; // 0-100
  signals: string[];
  raw?: any;
  error?: string;
}

// ── Real source fetchers ────────────────────────────────────────────────────

async function checkGithub(username: string): Promise<ModuleResult> {
  const res: ModuleResult = { source: 'GITHUB', riskScore: 0, signals: [] };
  if (!username) return res;
  try {
    const headers: any = { 'User-Agent': 'pabandi-bgcheck', Accept: 'application/vnd.github+json' };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    const r = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!r.ok) {
      res.riskScore = 30;
      res.signals.push('GitHub profile not found or private');
      return res;
    }
    const d = await r.json();
    const created = new Date(d.created_at).getTime();
    const ageDays = (Date.now() - created) / 86400000;
    const followers = d.followers || 0;
    const repos = d.public_repos || 0;

    res.raw = { followers, repos, ageDays: Math.floor(ageDays) };
    // Young + low-signal account = higher risk
    if (ageDays < 180) res.riskScore += 25;
    if (followers < 3 && repos < 3) res.riskScore += 20;
    if (repos >= 5 && followers >= 5) res.riskScore = Math.max(0, res.riskScore - 15);
    res.signals.push(`GitHub: ${repos} repos, ${followers} followers, ${Math.floor(ageDays)}d old`);
  } catch (e: any) {
    res.error = e.message;
    res.riskScore = 10;
  }
  return res;
}

async function checkDomain(domain: string): Promise<ModuleResult> {
  const res: ModuleResult = { source: 'DOMAIN_RDAP', riskScore: 0, signals: [] };
  if (!domain) return res;
  try {
    const clean = domain.replace(/^https?:\/\//, '').split('/')[0];
    const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${clean}`);
    if (!r.ok) {
      res.riskScore = 20;
      res.signals.push('Domain RDAP lookup failed');
      return res;
    }
    const d = await r.json();
    const events = d.events || [];
    const registered = events.find((e: any) => e.eventAction === 'registration')?.eventDate;
    const ageDays = registered ? (Date.now() - new Date(registered).getTime()) / 86400000 : 0;
    res.raw = { ageDays: Math.floor(ageDays), registrar: d.entities?.[0]?.vcardArray };
    if (ageDays < 90) {
      res.riskScore += 35;
      res.signals.push(`Domain only ${Math.floor(ageDays)}d old — high risk`);
    } else {
      res.signals.push(`Domain ${Math.floor(ageDays)}d old`);
    }
  } catch (e: any) {
    res.error = e.message;
    res.riskScore = 10;
  }
  return res;
}

async function checkNews(name: string): Promise<ModuleResult> {
  const res: ModuleResult = { source: 'GDELT_NEWS', riskScore: 0, signals: [] };
  if (!name) return res;
  try {
    const q = encodeURIComponent(`"${name}" (scam OR fraud OR lawsuit OR complaint)`);
    const r = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=15&format=json`);
    if (!r.ok) return res;
    const d = await r.json();
    const articles = d.articles || [];
    const negative = articles.filter((a: any) =>
      /scam|fraud|lawsuit|complaint| ripped|scammed|fake/i.test(a.title + (a.seendate || ''))
    );
    res.raw = { totalArticles: articles.length, negativeCount: negative.length };
    if (negative.length >= 3) {
      res.riskScore = 80;
      res.signals.push(`⚠ ${negative.length} negative news mentions`);
    } else if (negative.length > 0) {
      res.riskScore = 45;
      res.signals.push(`${negative.length} negative news mention(s)`);
    } else {
      res.signals.push('No negative news coverage found');
    }
  } catch (e: any) {
    res.error = e.message;
    res.riskScore = 5;
  }
  return res;
}

async function checkBreach(email: string): Promise<ModuleResult> {
  const res: ModuleResult = { source: 'HIBP', riskScore: 0, signals: [] };
  if (!email) return res;
  if (!HIBP_API_KEY) {
    res.signals.push('HIBP not configured (set HIBP_API_KEY)');
    return res;
  }
  try {
    const r = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
      headers: { 'hibp-api-key': HIBP_API_KEY, 'User-Agent': 'pabandi-bgcheck' },
    });
    if (r.status === 404) {
      res.signals.push('No known breaches for email');
      return res;
    }
    if (r.ok) {
      const breaches = await r.json();
      const count = breaches.length;
      res.raw = { breachCount: count, names: breaches.map((b: any) => b.Name) };
      res.riskScore = Math.min(70, count * 12);
      res.signals.push(`⚠ Email in ${count} breach(es)`);
    }
  } catch (e: any) {
    res.error = e.message;
  }
  return res;
}

async function checkSanctions(name: string, wallet?: string): Promise<ModuleResult> {
  const res: ModuleResult = { source: 'OFAC_SDN', riskScore: 0, signals: [] };
  if (!name && !wallet) return res;
  try {
    const r = await fetch('https://www.treasury.gov/ofac/downloads/sdn.csv', { signal: AbortSignal.timeout(12000) });
    if (!r.ok) {
      res.signals.push('OFAC list fetch failed');
      return res;
    }
    const csv = await r.text();
    const lines = csv.split('\n').map((l) => l.toLowerCase());
    const hit = lines.some((l) => name && l.includes(name.toLowerCase()));
    res.raw = { listSizeLines: lines.length, hit };
    if (hit) {
      res.riskScore = 100;
      res.signals.push('⛔ MATCH on OFAC sanctions list');
    } else {
      res.signals.push('Not found on OFAC SDN list');
    }
  } catch (e: any) {
    res.error = e.message;
    res.signals.push('OFAC check unavailable');
  }
  return res;
}

async function checkCompanyRegistry(companyName: string): Promise<ModuleResult> {
  const res: ModuleResult = { source: 'COMPANIES_HOUSE', riskScore: 0, signals: [] };
  if (!companyName) return res;
  if (!COMPANIES_HOUSE_KEY) {
    res.signals.push('Companies House not configured (set COMPANIES_HOUSE_KEY)');
    return res;
  }
  try {
    const r = await fetch(
      `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(companyName)}`,
      { headers: { Authorization: 'Basic ' + Buffer.from(COMPANIES_HOUSE_KEY + ':').toString('base64') } }
    );
    if (!r.ok) {
      res.signals.push('Company registry lookup failed');
      return res;
    }
    const d = await r.json();
    const items = d.items || [];
    res.raw = { matches: items.length };
    if (items.length === 0) {
      res.riskScore += 15;
      res.signals.push('No registered company found');
    } else {
      const dissolved = items.filter((i: any) => i.company_status === 'dissolved').length;
      if (dissolved > 0) {
        res.riskScore += 30;
        res.signals.push(`⚠ ${dissolved} dissolved entity(s) linked`);
      } else {
        res.signals.push(`Registered: ${items[0].title}`);
      }
    }
  } catch (e: any) {
    res.error = e.message;
  }
  return res;
}

// Lightweight OSINT composition (reuses existing threat engine if available)
async function runOsintFusion(req: CheckRequest): Promise<ModuleResult> {
  const res: ModuleResult = { source: 'OSINT_FUSION', riskScore: 0, signals: [] };
  try {
    const { threatFusionEngine } = await import('./osint/threatFusion.engine');
    const verdict = await threatFusionEngine.analyzeFull(req.subjectId || req.subjectName, {
      username: req.subjectGithub || req.subjectName,
      domain: req.subjectWebsite,
      walletAddress: req.subjectWallet,
    });
    res.riskScore = Math.round((verdict.plausibilityOfThreat || 0) * 100);
    res.raw = verdict;
    res.signals.push(`Threat fusion belief: ${res.riskScore}%`);
  } catch (e: any) {
    res.error = e.message;
  }
  return res;
}

// ── Composite scoring ──────────────────────────────────────────────────────

function bandFor(score: number): string {
  if (score >= 80) return 'E';
  if (score >= 60) return 'D';
  if (score >= 40) return 'C';
  if (score >= 20) return 'B';
  return 'A';
}

function recommendFor(score: number): string {
  if (score >= 70) return 'REJECT';
  if (score >= 40) return 'REVIEW';
  return 'PASS';
}

// Module weights by subject type (modules with empty output get weight removed)
function weightFor(subjectType: string, src: string): number {
  const base: Record<string, number> = {
    GITHUB: 0.12,
    DOMAIN_RDAP: 0.12,
    GDELT_NEWS: 0.2,
    HIBP: 0.12,
    OFAC_SDN: 0.3,
    COMPANIES_HOUSE: 0.12,
    OSINT_FUSION: 0.14,
  };
  let w = base[src] || 0.05;
  if (subjectType === 'FREELANCER' && src === 'GITHUB') w = 0.2;
  if (subjectType === 'PROPERTY_MANAGER' && src === 'COMPANIES_HOUSE') w = 0.22;
  if (subjectType === 'BUSINESS' && src === 'COMPANIES_HOUSE') w = 0.25;
  return w;
}

function summarize(modules: ModuleResult[], score: number, rec: string): string {
  const flags = modules.filter((m) => m.riskScore >= 40).flatMap((m) => m.signals);
  const clean = modules.filter((m) => m.riskScore < 40).flatMap((m) => m.signals);
  const head = `Composite risk ${score}/100 → ${rec}. `;
  const body = flags.length
    ? `Red flags: ${flags.slice(0, 4).join('; ')}.`
    : `No major red flags. ${clean.slice(0, 2).join('; ')}`;
  return head + body;
}

// ── Public API ─────────────────────────────────────────────────────────────

export class BackgroundCheckService {
  async createCheck(req: CheckRequest): Promise<string> {
    const check = await prisma.backgroundCheck.create({
      data: {
        subjectType: req.subjectType,
        subjectId: req.subjectId,
        subjectName: req.subjectName,
        subjectEmail: req.subjectEmail,
        subjectPhone: req.subjectPhone,
        subjectWallet: req.subjectWallet,
        subjectGithub: req.subjectGithub,
        subjectWebsite: req.subjectWebsite,
        subjectCompany: req.subjectCompany,
        requestedBy: req.requestedBy,
        trigger: req.trigger || 'MANUAL',
        webhookUrl: req.webhookUrl,
        status: 'PENDING',
      },
    });
    // Fire-and-forget async run
    this.runCheck(check.id).catch((e) => logger.error(`[BGCheck] run failed ${check.id}: ${e.message}`));
    return check.id;
  }

  async runCheck(checkId: string): Promise<void> {
    const check = await prisma.backgroundCheck.findUnique({ where: { id: checkId } });
    if (!check) return;
    await prisma.backgroundCheck.update({ where: { id: checkId }, data: { status: 'RUNNING' } });

    const req: CheckRequest = {
      subjectType: check.subjectType as any,
      subjectName: check.subjectName,
      subjectId: check.subjectId || undefined,
      subjectEmail: check.subjectEmail || undefined,
      subjectPhone: check.subjectPhone || undefined,
      subjectWallet: check.subjectWallet || undefined,
      subjectGithub: check.subjectGithub || undefined,
      subjectWebsite: check.subjectWebsite || undefined,
      subjectCompany: check.subjectCompany || undefined,
    };

    const modules = await Promise.all([
      checkGithub(req.subjectGithub || ''),
      checkDomain(req.subjectWebsite || ''),
      checkNews(req.subjectName),
      checkBreach(req.subjectEmail || ''),
      checkSanctions(req.subjectName, req.subjectWallet || undefined),
      checkCompanyRegistry(req.subjectCompany || ''),
      runOsintFusion(req),
    ]);

    // Weighted composite
    let totalW = 0;
    let weighted = 0;
    for (const m of modules) {
      const w = weightFor(check.subjectType, m.source);
      if (m.source === 'GITHUB' && !req.subjectGithub) continue;
      if (m.source === 'DOMAIN_RDAP' && !req.subjectWebsite) continue;
      if (m.source === 'HIBP' && !req.subjectEmail) continue;
      if (m.source === 'COMPANIES_HOUSE' && !req.subjectCompany) continue;
      weighted += m.riskScore * w;
      totalW += w;
    }
    const composite = totalW > 0 ? Math.round(weighted / totalW) : 0;

    // Hard safety overrides — reliability guardrails
    const sanctionsHit = modules.find((m) => m.source === 'OFAC_SDN' && m.riskScore >= 100);
    const osintCritical = modules.find((m) => m.source === 'OSINT_FUSION' && m.riskScore >= 70);
    const newsCritical = modules.find((m) => m.source === 'GDELT_NEWS' && m.riskScore >= 80);

    let finalScore = composite;
    let band = bandFor(composite);
    let rec = recommendFor(composite);
    if (sanctionsHit || osintCritical || newsCritical) {
      finalScore = Math.max(composite, 85);
      band = bandFor(finalScore);
      rec = 'REJECT';
    }

    const bySource: Record<string, any> = {};
    for (const m of modules) bySource[m.source] = m;

    await prisma.backgroundCheck.update({
      where: { id: checkId },
      data: {
        status: 'COMPLETE',
        riskScore: finalScore,
        riskBand: band,
        recommendation: rec,
        summary: summarize(modules, finalScore, rec),
        githubResult: bySource.GITHUB,
        domainResult: bySource.DOMAIN_RDAP,
        newsResult: bySource.GDELT_NEWS,
        breachResult: bySource.HIBP,
        sanctionsResult: bySource.OFAC_SDN,
        registryResult: bySource.COMPANIES_HOUSE,
        osintResult: bySource.OSINT_FUSION,
        completedAt: new Date(),
      },
    });

    // Webhook notification (streamlined automation output)
    if (check.webhookUrl) {
      try {
        await fetch(check.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkId,
            subjectName: check.subjectName,
            subjectType: check.subjectType,
            riskScore: composite,
            riskBand: band,
            recommendation: rec,
            summary: summarize(modules, composite, rec),
          }),
        });
      } catch (e: any) {
        logger.warn(`[BGCheck] webhook failed: ${e.message}`);
      }
    }

    logger.info(`[BGCheck] ${check.subjectType} ${check.subjectName} → score ${composite} band ${band} → ${rec}`);
  }

  async getCheck(checkId: string) {
    return prisma.backgroundCheck.findUnique({ where: { id: checkId } });
  }

  async listChecks(filter?: { subjectType?: string; status?: string; requestedBy?: string }) {
    return prisma.backgroundCheck.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Recurring re-screening — call from a scheduler to refresh high-value subjects.
   */
  async recheckDue(): Promise<number> {
    const due = await prisma.backgroundCheck.findMany({
      where: { status: 'COMPLETE', updatedAt: { lt: new Date(Date.now() - 30 * 86400000) } },
      take: 50,
    });
    for (const c of due) {
      this.runCheck(c.id).catch((e) => logger.error(`[BGCheck] recheck failed ${c.id}: ${e.message}`));
    }
    return due.length;
  }

  /**
   * Batch screening — used by funnel to vet many freelancers/property managers at once.
   */
  async batchScreen(requests: CheckRequest[]): Promise<string[]> {
    const ids: string[] = [];
    for (const r of requests) {
      ids.push(await this.createCheck(r));
    }
    return ids;
  }
}

export const backgroundCheckService = new BackgroundCheckService();
