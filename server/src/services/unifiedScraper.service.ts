import { logger } from '../utils/logger';
import { serviceProviderIngestion, type ExternalProviderProfile } from './serviceProviderIngestion.service';

let playwrightBrowser: Awaited<ReturnType<typeof import('playwright').chromium.launch>> | null = null;
let puppeteerBrowser: Awaited<ReturnType<typeof import('puppeteer').launch>> | null = null;

type BrowserType = 'playwright' | 'puppeteer';

export type ScrapeSource = 'manual' | 'upwork' | 'taskrabbit' | 'fiverr' | 'thumbtack' | 'jobber' | 'broccoli';

/**
 * Get or launch a Playwright browser instance.
 * Reuses the same browser across calls.
 */
async function getPlaywrightBrowser() {
  if (!playwrightBrowser) {
    const { chromium } = await import('playwright');
    playwrightBrowser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
  }
  return playwrightBrowser;
}

/**
 * Get or launch a Puppeteer browser instance.
 * Reuses the same browser across calls.
 */
async function getPuppeteerBrowser() {
  if (!puppeteerBrowser) {
    const puppeteer = await import('puppeteer');
    puppeteerBrowser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
  }
  return puppeteerBrowser;
}

/**
 * Close all browser instances. Call on server shutdown.
 */
export async function closeAllScraperBrowsers() {
  if (playwrightBrowser) {
    await playwrightBrowser.close();
    playwrightBrowser = null;
  }
  if (puppeteerBrowser) {
    await puppeteerBrowser.close();
    puppeteerBrowser = null;
  }
}

/**
 * Scrape a provider profile page using either Playwright or Puppeteer.
 * Tries Playwright first (better anti-bot evasion), falls back to Puppeteer.
 */
async function scrapeWithFallback(
  url: string,
  pageFn: (page: any, browserType: BrowserType) => Promise<any>,
  browserType: BrowserType = 'playwright'
): Promise<any> {
  let lastError: Error | null = null;

  for (const type of [browserType, browserType === 'playwright' ? 'puppeteer' : 'playwright']) {
    try {
      if (type === 'playwright') {
        const browser = await getPlaywrightBrowser();
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const result = await pageFn(page, 'playwright');
        await page.close();
        await context.close();
        return result;
      } else {
        const browser = await getPuppeteerBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const result = await pageFn(page, 'puppeteer');
        await page.close();
        return result;
      }
    } catch (err: any) {
      lastError = err;
      logger.warn(`[UnifiedScraper] ${type} failed for ${url}: ${err.message}, trying fallback`);
    }
  }

  throw lastError || new Error(`All browser types failed for ${url}`);
}

/**
 * Normalize a raw scraped profile into ExternalProviderProfile format.
 */
function normalizeScrapedProfile(
  source: ExternalProviderProfile['source'],
  sourceId: string,
  raw: {
    name?: string;
    bio?: string;
    location?: string;
    websiteUrl?: string;
    avatarUrl?: string;
    hourlyRate?: number;
    currency?: string;
    skills?: string[];
    category?: string;
    rating?: number;
    reviewCount?: number;
    totalEarnings?: number;
    jobsCompleted?: number;
    accountAgeDays?: number;
    isVerified?: boolean;
    accountLevel?: string;
    portfolioUrls?: string[];
    rawData?: Record<string, any>;
  }
): ExternalProviderProfile {
  const handle = raw.name
    ? raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + sourceId.slice(-6)
    : sourceId;

  return {
    source,
    sourceId,
    name: raw.name || 'Unknown Provider',
    handle,
    bio: raw.bio,
    location: raw.location,
    websiteUrl: raw.websiteUrl,
    avatarUrl: raw.avatarUrl,
    hourlyRate: raw.hourlyRate,
    currency: raw.currency || 'USD',
    skills: raw.skills || [],
    category: raw.category || 'FREELANCER',
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    totalEarnings: raw.totalEarnings,
    jobsCompleted: raw.jobsCompleted,
    accountAgeDays: raw.accountAgeDays,
    isVerified: raw.isVerified || false,
    accountLevel: raw.accountLevel,
    portfolioUrls: raw.portfolioUrls || [],
    rawData: raw.rawData || {},
  };
}

/**
 * Scrape a Jobber service professional profile.
 * Jobber is field service management software for home services (HVAC, plumbing, cleaning, etc.)
 * Public profile URLs look like: getjobber.com/providers/username or getjobber.com/business/username
 */
export async function scrapeJobberProfile(profileUrl: string): Promise<Partial<ExternalProviderProfile>> {
  const result = await scrapeWithFallback(profileUrl, async (page: any) => {
    await page.waitForTimeout(3000); // Let Jobber's React app hydrate

    const data = await page.evaluate(() => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() : null;
      };

      const name = getText('h1') || getText('.provider-name') || getText('.business-name') || 'Unknown Provider';
      const ratingText = getText('.rating') || getText('.stars') || getText('[data-testid="rating"]');
      const rating = ratingText ? parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1] || '0') : undefined;

      const reviewsText = getText('.reviews') || getText('.review-count') || '';
      const reviewCount = reviewsText ? parseInt(reviewsText.replace(/[^\d]/g, ''), 10) : undefined;

      const bioEl = document.querySelector('.bio, .description, .about');
      const bio = bioEl ? bioEl.textContent?.trim() : undefined;

      const locationEl = document.querySelector('.location, .address, .service-area');
      const location = locationEl ? locationEl.textContent?.trim() : undefined;

      const hourlyText = getText('.hourly-rate') || getText('.rate') || '';
      const hourlyRate = hourlyText ? parseFloat(hourlyText.replace(/[^\d.]/g, '')) : undefined;

      const skillEls = document.querySelectorAll('.skill, .service, .specialty');
      const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean);

      const avatarEl = document.querySelector('img.profile-pic, img.avatar, img[src*="profile"]');
      const avatarUrl = avatarEl ? (avatarEl as HTMLImageElement).src : undefined;

      const verifiedEl = document.querySelector('.verified, .badge-verified, [data-verified="true"]');
      const isVerified = !!verifiedEl;

      return { name, rating, reviewCount, bio, location, hourlyRate, skills, avatarUrl, isVerified };
    });

    const sourceId = profileUrl.split('/').pop() || profileUrl;

    return normalizeScrapedProfile('jobber', sourceId, {
      ...data,
      category: 'HOME_SERVICE',
      rawData: { sourceUrl: profileUrl },
    });
  });

  return result;
}

/**
 * Scrape a Broccoli service provider profile.
 * Broccoli is field service management for home services.
 * Public profile URLs look like: broccoli.io/providers/username or broccoli.io/business/username
 */
export async function scrapeBroccoliProfile(profileUrl: string): Promise<Partial<ExternalProviderProfile>> {
  const result = await scrapeWithFallback(profileUrl, async (page: any) => {
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() : null;
      };

      const name = getText('h1') || getText('.provider-name') || getText('.business-name') || 'Unknown Provider';
      const ratingText = getText('.rating') || getText('.stars') || '';
      const rating = ratingText ? parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1] || '0') : undefined;

      const reviewsText = getText('.reviews') || getText('.review-count') || '';
      const reviewCount = reviewsText ? parseInt(reviewsText.replace(/[^\d]/g, ''), 10) : undefined;

      const bioEl = document.querySelector('.bio, .description, .about-provider');
      const bio = bioEl ? bioEl.textContent?.trim() : undefined;

      const locationEl = document.querySelector('.location, .service-area, .city');
      const location = locationEl ? locationEl.textContent?.trim() : undefined;

      const hourlyText = getText('.hourly') || getText('.rate') || '';
      const hourlyRate = hourlyText ? parseFloat(hourlyText.replace(/[^\d.]/g, '')) : undefined;

      const skillEls = document.querySelectorAll('.skill, .service-type, .offering');
      const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean);

      const avatarEl = document.querySelector('img.avatar, img.profile-image, img[src*="avatar"]');
      const avatarUrl = avatarEl ? (avatarEl as HTMLImageElement).src : undefined;

      return { name, rating, reviewCount, bio, location, hourlyRate, skills, avatarUrl };
    });

    const sourceId = profileUrl.split('/').pop() || profileUrl;

    return normalizeScrapedProfile('broccoli', sourceId, {
      ...data,
      category: 'HOME_SERVICE',
      rawData: { sourceUrl: profileUrl },
    });
  });

  return result;
}

/**
 * Scrape a provider profile from any supported platform.
 * Auto-detects platform from URL.
 */
export async function scrapeMarketplaceProfile(profileUrl: string): Promise<Partial<ExternalProviderProfile>> {
  const lowerUrl = profileUrl.toLowerCase();

  if (lowerUrl.includes('fiverr.com')) {
    return scrapeFiverrProfile(profileUrl);
  }
  if (lowerUrl.includes('taskrabbit.com')) {
    return scrapeTaskRabbitProfile(profileUrl);
  }
  if (lowerUrl.includes('upwork.com')) {
    return scrapeUpworkProfile(profileUrl);
  }
  if (lowerUrl.includes('getjobber.com') || lowerUrl.includes('jobber.com')) {
    return scrapeJobberProfile(profileUrl);
  }
  if (lowerUrl.includes('broccoli.io') || lowerUrl.includes('broccoli.com')) {
    return scrapeBroccoliProfile(profileUrl);
  }

  throw new Error(`Unsupported marketplace URL: ${profileUrl}. Supported: fiverr.com, taskrabbit.com, upwork.com, getjobber.com, broccoli.io`);
}

// ═════════════════════════════════════════════════════════════════════════════
// Individual platform scrapers (Puppeteer-based, existing implementations)
// ═════════════════════════════════════════════════════════════════════════════

async function scrapeFiverrProfile(profileUrl: string): Promise<Partial<ExternalProviderProfile>> {
  const result = await scrapeWithFallback(profileUrl, async (page: any) => {
    await page.waitForSelector('.seller-name, .profile-name, h1', { timeout: 10000 }).catch(() => {});

    const data = await page.evaluate(() => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() : null;
      };

      const name = getText('.seller-name') || getText('.profile-name') || getText('h1') || 'Unknown Seller';
      const ratingText = getText('.rating-stars') || getText('.reviews-stars') || '';
      const rating = ratingText ? parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1] || '0') : undefined;

      const reviewsText = getText('.reviews-count') || getText('.seller-reviews') || '';
      const reviewCount = reviewsText ? parseInt(reviewsText.replace(/[^\d]/g, ''), 10) : undefined;

      const levelText = getText('.seller-level') || getText('.level-badge') || '';
      const accountLevel = levelText || undefined;

      const bioEl = document.querySelector('.profile-description, .seller-bio, .about-seller');
      const bio = bioEl ? bioEl.textContent?.trim() : undefined;

      const locationEl = document.querySelector('.seller-location, .profile-location');
      const location = locationEl ? locationEl.textContent?.trim() : undefined;

      const skillEls = document.querySelectorAll('.skill-tag, .profile-skill, .service-tag');
      const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean);

      const avatarEl = document.querySelector('.profile-picture img, .seller-avatar img');
      const avatarUrl = avatarEl ? (avatarEl as HTMLImageElement).src : undefined;

      return { name, rating, reviewCount, accountLevel, bio, location, skills, avatarUrl };
    });

    const sourceId = profileUrl.split('/').pop() || profileUrl;

    return normalizeScrapedProfile('fiverr', sourceId, {
      ...data,
      category: 'FREELANCER',
      rawData: { sourceUrl: profileUrl },
    });
  });

  return result;
}

async function scrapeTaskRabbitProfile(profileUrl: string): Promise<Partial<ExternalProviderProfile>> {
  const result = await scrapeWithFallback(profileUrl, async (page: any) => {
    await page.waitForSelector('h1, .tasker-name, [data-testid="tasker-name"]', { timeout: 10000 }).catch(() => {});

    const data = await page.evaluate(() => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() : null;
      };

      const name = getText('h1') || getText('.tasker-name') || 'Unknown Tasker';
      const ratingText = getText('.rating') || getText('.star-rating') || '';
      const rating = ratingText ? parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1] || '0') : undefined;

      const reviewsText = getText('.review-count') || getText('.reviews') || '';
      const reviewCount = reviewsText ? parseInt(reviewsText.replace(/[^\d]/g, ''), 10) : undefined;

      const hourlyText = getText('.hourly-rate') || getText('.price') || '';
      const hourlyRate = hourlyText ? parseFloat(hourlyText.replace(/[^\d.]/g, '')) : undefined;

      const bioEl = document.querySelector('.tasker-bio, .about-tasker, .profile-description');
      const bio = bioEl ? bioEl.textContent?.trim() : undefined;

      const locationEl = document.querySelector('.tasker-location, .profile-location');
      const location = locationEl ? locationEl.textContent?.trim() : undefined;

      const skillEls = document.querySelectorAll('.skill-tag, .service-type, .tasker-skill');
      const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean);

      const avatarEl = document.querySelector('.profile-picture img, .tasker-avatar img');
      const avatarUrl = avatarEl ? (avatarEl as HTMLImageElement).src : undefined;

      return { name, rating, reviewCount, hourlyRate, bio, location, skills, avatarUrl };
    });

    const sourceId = profileUrl.split('/').pop() || profileUrl;

    return normalizeScrapedProfile('taskrabbit', sourceId, {
      ...data,
      category: 'HOME_SERVICE',
      rawData: { sourceUrl: profileUrl },
    });
  });

  return result;
}

async function scrapeUpworkProfile(profileUrl: string): Promise<Partial<ExternalProviderProfile>> {
  const result = await scrapeWithFallback(profileUrl, async (page: any) => {
    await page.waitForSelector('h1, .profile-name, [data-testid="freelancer-name"]', { timeout: 10000 }).catch(() => {});

    const data = await page.evaluate(() => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() : null;
      };

      const name = getText('h1') || getText('.profile-name') || 'Unknown Freelancer';
      const ratingText = getText('.rating') || getText('.star-rating') || '';
      const rating = ratingText ? parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1] || '0') : undefined;

      const reviewsText = getText('.review-count') || getText('.reviews') || '';
      const reviewCount = reviewsText ? parseInt(reviewsText.replace(/[^\d]/g, ''), 10) : undefined;

      const hourlyText = getText('.hourly-rate') || getText('.price') || '';
      const hourlyRate = hourlyText ? parseFloat(hourlyText.replace(/[^\d.]/g, '')) : undefined;

      const bioEl = document.querySelector('.profile-description, .about-freelancer, .overview');
      const bio = bioEl ? bioEl.textContent?.trim() : undefined;

      const locationEl = document.querySelector('.profile-location, .freelancer-location');
      const location = locationEl ? locationEl.textContent?.trim() : undefined;

      const skillEls = document.querySelectorAll('.skill-tag, .profile-skill, .freelancer-skill');
      const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean);

      const avatarEl = document.querySelector('.profile-picture img, .freelancer-avatar img');
      const avatarUrl = avatarEl ? (avatarEl as HTMLImageElement).src : undefined;

      return { name, rating, reviewCount, hourlyRate, bio, location, skills, avatarUrl };
    });

    const sourceId = profileUrl.split('/').pop() || profileUrl;

    return normalizeScrapedProfile('upwork', sourceId, {
      ...data,
      category: 'FREELANCER',
      rawData: { sourceUrl: profileUrl },
    });
  });

  return result;
}

/**
 * Scrape multiple provider profiles and ingest them all into Pabandi.
 */
export async function scrapeAndIngestProfiles(
  profileUrls: string[]
): Promise<{
  ingested: Array<{ passportId: string; handle: string; displayName: string; trustScore: number; riskBand: string; source: string; sourceId: string }>;
  errors: Array<{ url: string; error: string }>;
}> {
  const ingested: Array<{ passportId: string; handle: string; displayName: string; trustScore: number; riskBand: string; source: string; sourceId: string }> = [];
  const errors: Array<{ url: string; error: string }> = [];

  for (const url of profileUrls) {
    try {
      const scraped = await scrapeMarketplaceProfile(url);
      const profile: ExternalProviderProfile = {
        source: (scraped.source as ExternalProviderProfile['source']) || 'manual',
        sourceId: scraped.sourceId || url.split('/').pop() || url,
        name: scraped.name || 'Unknown Provider',
        handle: scraped.handle || url.split('/').pop() || url,
        bio: scraped.bio,
        location: scraped.location,
        websiteUrl: scraped.websiteUrl,
        avatarUrl: scraped.avatarUrl,
        hourlyRate: scraped.hourlyRate,
        currency: scraped.currency || 'USD',
        skills: scraped.skills || [],
        category: scraped.category || 'FREELANCER',
        rating: scraped.rating,
        reviewCount: scraped.reviewCount,
        totalEarnings: scraped.totalEarnings,
        jobsCompleted: scraped.jobsCompleted,
        accountAgeDays: scraped.accountAgeDays,
        isVerified: scraped.isVerified,
        accountLevel: scraped.accountLevel,
        portfolioUrls: scraped.portfolioUrls,
        rawData: scraped.rawData,
      };

      const result = await serviceProviderIngestion.ingestProvider(profile);
      ingested.push({
        passportId: result.passportId,
        handle: result.handle,
        displayName: result.displayName,
        trustScore: result.trustScore,
        riskBand: result.riskBand,
        source: result.source,
        sourceId: result.sourceId,
      });

      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err: any) {
      errors.push({ url, error: err.message });
      logger.error(`[UnifiedScraper] Failed to scrape and ingest ${url}: ${err.message}`);
    }
  }

  return { ingested, errors };
}

export const unifiedScraper = {
  scrapeMarketplaceProfile,
  scrapeFiverrProfile,
  scrapeTaskRabbitProfile,
  scrapeUpworkProfile,
  scrapeJobberProfile,
  scrapeBroccoliProfile,
  scrapeAndIngestProfiles,
  closeAllScraperBrowsers,
};
