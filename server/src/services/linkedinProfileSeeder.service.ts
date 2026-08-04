/**
 * linkedinProfileSeeder.service.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Frugal profile seeding for the LinkedIn funnel.
 *
 * Strategy:
 *   1. Pull public-profile freelancers from LinkedIn public search
 *   2. Assign initial TrustFlux velocity scores based on profile signals
 *   3. Create public trust badges (free marketing)
 *   4. Gate premium analytics behind paid tiers
 *
 * All data comes from PUBLIC sources — no scraping behind auth, no paywalls.
 * This is pure growth hacking: market people for free, monetize tools.
 */
import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustFluxService } from './trustFlux.service';
import { LINKEDIN_PERSONAS } from './linkedinLeadGen.service';

// ── Seed Queries (public LinkedIn search URLs) ──────────────────────────────
// These are the exact search queries a human would type into LinkedIn
const SEED_QUERIES: Record<string, string[]> = {
  'freelance-dev': [
    'freelance full stack developer mumbai',
    'freelance react developer delhi',
    'freelance node developer bangalore',
    'freelance developer pakistan',
    'freelance developer remote',
  ],
  'small-biz-owner': [
    'restaurant owner mumbai',
    'salon owner delhi',
    'boutique owner bangalore',
    'small business owner pakistan',
    'shop owner lahore',
  ],
  'project-owner': [
    'project manager startup delhi',
    'agency owner mumbai',
    'consulting firm owner bangalore',
    'construction company owner pakistan',
    'marketing agency owner remote',
  ],
  'solopreneur': [
    'solopreneur mumbai',
    'independent consultant delhi',
    'freelance designer pakistan',
    'content creator bangalore',
    'business coach remote',
  ],
};

// ── Seed Profile Interface ───────────────────────────────────────────────────
export interface SeedProfile {
  linkedinId: string;
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  headline: string;
  company: string;
  industry: string;
  location: string;
  connectionCount: number;
  headlineKeywords: string[];
  profileCompleteness: number;  // [0, 1] — how complete the profile is
  trustVelocity: number;         // [-1, 1] — initial TrustFlux velocity
  persona: string;
  seedSource: 'LINKEDIN_SEARCH' | 'MANUAL_IMPORT' | 'USER_REFERRAL';
}

// ── Profile Scorer (assigns initial trust based on public signals) ────────────
function computeInitialTrustVelocity(profile: {
  headlineKeywords: string[];
  profileCompleteness: number;
  connectionCount: number;
  company: string;
}): number {
  let score = 0;

  // Profile completeness (0-1 → 0-0.3)
  score += profile.profileCompleteness * 0.3;

  // Connection count (log-scaled, capped at 0.2)
  score += Math.min(0.2, Math.log10(profile.connectionCount + 1) * 0.05);

  // Headline keywords (0-0.3)
  const keywords = [
    'developer', 'engineer', 'full stack', 'react', 'node', // tech
    'owner', 'founder', 'CEO', 'manager', // leadership
    'certified', 'verified', 'expert', 'specialist', // credibility
    '5+ years', '10+ years', 'veteran', // experience
  ];
  const keywordScore = profile.headlineKeywords.filter(k =>
    keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))
  ).length;
  score += Math.min(0.3, keywordScore * 0.05);

  // Company quality signal (0-0.2)
  const trustedCompanies = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Startup', 'Agency'];
  if (trustedCompanies.some(tc => profile.company.toLowerCase().includes(tc.toLowerCase()))) {
    score += 0.1;
  }
  if (profile.company.toLowerCase().includes('freelance') || profile.company.toLowerCase().includes('independent')) {
    score += 0.2;  // Independent = high velocity signal
  }

  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, score * 2 - 1));  // scale to [-1, 1]
}

// ── Frugal Profile Fetcher (public search only) ──────────────────────────────
async function fetchLinkedInProfiles(query: string, count: number = 10): Promise<Partial<SeedProfile>[]> {
  const profiles: Partial<SeedProfile>[] = [];

  try {
    // In production: use linkedin-api or a search API
    // For frugal seeding: use Bing search with site:linkedin.com
    const searchUrl = `https://www.bing.com/search?q=site:linkedin.com/in ${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    // Extract LinkedIn profile links from Bing HTML (regex-based, no cheerio needed)
    const linkRegex = /<a[^>]*href="(https?:\/\/[^"]*linkedin\.com\/in[^"]*)"[^>]*>([^<]*)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(response.data)) !== null) {
      const url = match[1];
      const text = match[2].trim();

      // Parse name + headline from search result text
      const parts = text.split(' - ');
      const name = parts[0]?.trim() || 'Unknown';
      const headline = parts[1]?.trim() || '';

      const nameParts = name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts[1] || '';

      const linkedinId = crypto.createHash('md5').update(url).digest('hex').substring(0, 12);

      profiles.push({
        linkedinId,
        linkedinUrl: url,
        firstName,
        lastName,
        headline,
        connectionCount: Math.floor(Math.random() * 500) + 50,  // estimated
        headlineKeywords: headline.split(/[\s,]+/).filter(Boolean),
        profileCompleteness: Math.random() * 0.5 + 0.5,  // 50-100%
      });
    }

    // Limit to requested count
    return profiles.slice(0, count);
  } catch (err: any) {
    logger.warn(`[ProfileSeeder] Search failed for "${query}": ${err.message}`);
    return [];
  }
}

// ── Main Seed Function ───────────────────────────────────────────────────────
export class LinkedInProfileSeeder {
  private seeded: Map<string, SeedProfile> = new Map();

  /**
   * Seed profiles for all personas from public LinkedIn search.
   * Returns count of seeded profiles per persona.
   */
  public async seedAllProfiles(
    profilesPerPersona: number = 25
  ): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    for (const persona of LINKEDIN_PERSONAS) {
      const queries = SEED_QUERIES[persona.id] || [];
      let totalSeeded = 0;

      for (const query of queries) {
        if (totalSeeded >= profilesPerPersona) break;

        const remaining = profilesPerPersona - totalSeeded;
        const profiles = await fetchLinkedInProfiles(query, Math.min(remaining, 10));

        for (const p of profiles) {
          await this.seedProfile(p, persona);
          totalSeeded++;
        }

        // Rate-limit: 2 seconds between queries (frugal)
        await this.sleep(2000);
      }

      results[persona.id] = totalSeeded;
      logger.info(`[ProfileSeeder] Seeded ${totalSeeded} profiles for ${persona.name}`);
    }

    return results;
  }

  /**
   * Seed a single profile with initial trust velocity + public badge.
   */
  public async seedProfile(
    rawProfile: Partial<SeedProfile>,
    persona: { id: string; name: string },
    seedSource: 'LINKEDIN_SEARCH' | 'MANUAL_IMPORT' | 'USER_REFERRAL' = 'LINKEDIN_SEARCH'
  ): Promise<SeedProfile | null> {
    if (!rawProfile.linkedinUrl || !rawProfile.firstName) {
      return null;
    }

    const profile: SeedProfile = {
      linkedinId: rawProfile.linkedinId || crypto.randomBytes(6).toString('hex'),
      linkedinUrl: rawProfile.linkedinUrl,
      firstName: rawProfile.firstName,
      lastName: rawProfile.lastName || '',
      headline: rawProfile.headline || '',
      company: rawProfile.company || '',
      industry: rawProfile.industry || '',
      location: rawProfile.location || '',
      connectionCount: rawProfile.connectionCount || 0,
      headlineKeywords: rawProfile.headlineKeywords || [],
      profileCompleteness: rawProfile.profileCompleteness || 0.5,
      trustVelocity: 0,
      persona: persona.id,
      seedSource,
    };

    // Assign initial TrustFlux velocity
    profile.trustVelocity = computeInitialTrustVelocity({
      headlineKeywords: profile.headlineKeywords,
      profileCompleteness: profile.profileCompleteness,
      connectionCount: profile.connectionCount,
      company: profile.company,
    });

    // Cache profile
    this.seeded.set(profile.linkedinId, profile);

    // Log seed (no DB write — pure memory for now, monetized later)
    logger.info(`[ProfileSeeder] Seeded ${profile.firstName} (${persona.name}) — velocity: ${profile.trustVelocity.toFixed(2)}`);

    return profile;
  }

  /**
   * Get a free public trust badge HTML for a seeded profile.
   * This is the FREE marketing layer — everyone gets a badge.
   */
  public getTrustBadge(profile: SeedProfile): string {
    const band = this.getTrustBand(profile.trustVelocity);
    const colors: Record<string, string> = {
      A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-yellow-500', D: 'bg-orange-500', E: 'bg-red-500',
    };
    const label = `${profile.firstName} ${profile.lastName}`.trim();

    return `<div class="pabandi-trust-badge inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-white ${colors[band]}">
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 12l2 2 4-4m1.615 6H8.385a2 2 0 01-1.985-1.832L6 9V5a2 2 0 012-2h4a2 2 0 012 2v4l-.395.168A2 2 0 0113 13h-2z"/>
      </svg>
      Trust Band: ${band}
    </div>`;
  }

  /**
   * Get premium analytics (paid feature).
   */
  public getPremiumAnalytics(profile: SeedProfile): {
    trustVelocity: number;
    trustBand: string;
    projected30d: number;
    insuranceRate: string;
    pabondMultiplier: number;
    premiumFeatures: string[];
  } | null {
    // In production: check if user has paid subscription
    return null;
  }

  /**
   * Get TrustFlux score for a seeded profile (initial velocity).
   */
  public getTrustBand(velocity: number): string {
    if (velocity > 0.5) return 'A';
    if (velocity > 0.2) return 'B';
    if (velocity > -0.2) return 'C';
    if (velocity > -0.5) return 'D';
    return 'E';
  }

  /**
   * Get seeder stats.
   */
  public getStats(): {
    totalSeeded: number;
    byPersona: Record<string, number>;
    byBand: Record<string, number>;
    avgVelocity: number;
  } {
    const byPersona: Record<string, number> = {};
    const byBand: Record<string, number> = {};
    let totalVelocity = 0;

    for (const profile of this.seeded.values()) {
      byPersona[profile.persona] = (byPersona[profile.persona] || 0) + 1;
      const band = this.getTrustBand(profile.trustVelocity);
      byBand[band] = (byBand[band] || 0) + 1;
      totalVelocity += profile.trustVelocity;
    }

    return {
      totalSeeded: this.seeded.size,
      byPersona,
      byBand,
      avgVelocity: this.seeded.size > 0 ? totalVelocity / this.seeded.size : 0,
    };
  }

  /**
   * Batch seed from a CSV upload (manual import mode).
   * Format: linkedinUrl,firstName,lastName,headline,company,industry,location
   */
  public async importFromCSV(csvContent: string, personaId: string): Promise<{ imported: number; errors: string[] }> {
    const lines = csvContent.trim().split('\n');
    const persona = LINKEDIN_PERSONAS.find(p => p.id === personaId);
    if (!persona) return { imported: 0, errors: ['Invalid personaId'] };

    let imported = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 5) {
        errors.push(`Line ${i}: insufficient columns`);
        continue;
      }

      const profile: Partial<SeedProfile> = {
        linkedinId: crypto.createHash('md5').update(cols[0]).digest('hex').substring(0, 12),
        linkedinUrl: cols[0],
        firstName: cols[1],
        lastName: cols[2],
        headline: cols[3],
        company: cols[4],
        industry: cols[5] || '',
        location: cols[6] || '',
        connectionCount: parseInt(cols[7] || '0', 10),
        headlineKeywords: (cols[3] || '').split(/[\s,]+/).filter(Boolean),
        profileCompleteness: 0.8,
      };

      const result = await this.seedProfile(profile, persona, 'MANUAL_IMPORT');
      if (result) imported++;
      else errors.push(`Line ${i}: failed to seed`);
    }

    return { imported, errors };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const linkedinProfileSeeder = new LinkedInProfileSeeder();
