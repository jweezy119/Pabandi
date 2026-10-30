import { logger } from '../utils/logger';
import { serviceProviderIngestion, type ExternalProviderProfile } from './serviceProviderIngestion.service';

let browser: Awaited<ReturnType<typeof import('puppeteer').launch>> | null = null;

/**
 * Get or launch a Puppeteer browser instance.
 * Reuses the same browser across calls to avoid launch overhead.
 */
async function getBrowser() {
  if (!browser) {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.launch({
      headless: 'new',
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
  return browser;
}

/**
 * Close the Puppeteer browser. Call on server shutdown.
 */
export async function closeScraperBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Scrape a Fiverr seller profile page for public data.
 * Fiverr profile URLs look like: fiverr.com/seller_username
 */
export async function scrapeFiverrProfile(profileUrl: string): Promise<Partial<ExternalProviderProfile>> {
  const page = await (await getBrowser()).newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for seller name
    await page.waitForSelector('.seller-name, .profile-name, h1', { timeout: 10000 }).catch(() => {});

    const data = await page.evaluate(() => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() : null;
      };

      const name = getText('.seller-name') || getText('.profile-name') || getText('h1') || 'Unknown Seller';
      const ratingText = getText('.rating-stars') || getText('.reviews-stars') || getText('[data-testid="seller-rating"]');
      const rating = ratingText ? parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1] || '0') : undefined;

      const reviewsText = getText('.reviews-count') || getText('.seller-reviews') || '';
      const reviewCount = reviewsText ? parseInt(reviewsText.replace(/[^\d]/g, ''), 10) : undefined;

      const levelText = getText('.seller-level') || getText('.level-badge') || '';
      const accountLevel = levelText || undefined;

      const bioEl = document.querySelector('.profile-description, .seller-bio, .about-seller');
      const bio = bioEl ? bioEl.textContent?.trim() : undefined;

      const locationEl = document.querySelector('.seller-location, .profile-location');
      const location = locationEl ? locationEl.textContent?.trim() : undefined;

      // Extract skills from tags
      const skillEls = document.querySelectorAll('.skill-tag, .profile-skill, .service-tag');
      const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean);

      // Extract avatar
      const avatarEl = document.querySelector('.profile-picture img, .seller-avatar img');
      const avatarUrl = avatarEl ? (avatarEl as HTMLImageElement).src : undefined;

      return { name, rating, reviewCount, accountLevel, bio, location, skills, avatarUrl };
    });

    const sourceId = profileUrl.split('/').pop() || profileUrl;

    return {
      source: 'fiverr',
      sourceId,
      name: data.name || 'Unknown Seller',
      handle: data.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || sourceId,
      bio: data.bio,
      location: data.location,
      websiteUrl: undefined,
      avatarUrl: data.avatarUrl,
      hourlyRate: undefined,
      currency: 'USD',
      skills: data.skills || [],
      category: 'FREELANCER',
      rating: data.rating,
      reviewCount: data.reviewCount,
      totalEarnings: undefined,
      jobsCompleted: undefined,
      accountAgeDays: undefined,
      isVerified: false,
      accountLevel: data.accountLevel,
      portfolioUrls: [],
      rawData: { sourceUrl: profileUrl },
    };
  } catch (err: any) {
    logger.error(`[PuppeteerScraper] Fiverr scrape failed for ${profileUrl}: ${err.message}`);
    throw err;
  } finally {
    await page.close();
  }
}

/**
 * Scrape a TaskRabbit tasker profile page for public data.
 * TaskRabbit profile URLs look like: taskrabbit.com/tasker/username
 */
export async function scrapeTaskRabbitProfile(profileUrl: string): Promise<Partial<ExternalProviderProfile>> {
  const page = await (await getBrowser()).newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.waitForSelector('h1, .tasker-name, [data-testid="tasker-name"]', { timeout: 10000 }).catch(() => {});

    const data = await page.evaluate(() => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() : null;
      };

      const name = getText('h1') || getText('.tasker-name') || 'Unknown Tasker';
      const ratingText = getText('.rating') || getText('.star-rating') || getText('[data-testid="rating"]');
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

    return {
      source: 'taskrabbit',
      sourceId,
      name: data.name || 'Unknown Tasker',
      handle: data.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || sourceId,
      bio: data.bio,
      location: data.location,
      websiteUrl: undefined,
      avatarUrl: data.avatarUrl,
      hourlyRate: data.hourlyRate,
      currency: 'USD',
      skills: data.skills || [],
      category: 'FREELANCER',
      rating: data.rating,
      reviewCount: data.reviewCount,
      totalEarnings: undefined,
      jobsCompleted: undefined,
      accountAgeDays: undefined,
      isVerified: false,
      accountLevel: undefined,
      portfolioUrls: [],
      rawData: { sourceUrl: profileUrl },
    };
  } catch (err: any) {
    logger.error(`[PuppeteerScraper] TaskRabbit scrape failed for ${profileUrl}: ${err.message}`);
    throw err;
  } finally {
    await page.close();
  }
}

/**
 * Scrape an Upwork freelancer profile page for public data.
 * Upwork profile URLs look like: upwork.com/freelancers/username
 */
export async function scrapeUpworkProfile(profileUrl: string): Promise<Partial<ExternalProviderProfile>> {
  const page = await (await getBrowser()).newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.waitForSelector('h1, .profile-name, [data-testid="freelancer-name"]', { timeout: 10000 }).catch(() => {});

    const data = await page.evaluate(() => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() : null;
      };

      const name = getText('h1') || getText('.profile-name') || 'Unknown Freelancer';
      const ratingText = getText('.rating') || getText('.star-rating') || getText('[data-testid="rating"]');
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

    return {
      source: 'upwork',
      sourceId,
      name: data.name || 'Unknown Freelancer',
      handle: data.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || sourceId,
      bio: data.bio,
      location: data.location,
      websiteUrl: undefined,
      avatarUrl: data.avatarUrl,
      hourlyRate: data.hourlyRate,
      currency: 'USD',
      skills: data.skills || [],
      category: 'FREELANCER',
      rating: data.rating,
      reviewCount: data.reviewCount,
      totalEarnings: undefined,
      jobsCompleted: undefined,
      accountAgeDays: undefined,
      isVerified: false,
      accountLevel: undefined,
      portfolioUrls: [],
      rawData: { sourceUrl: profileUrl },
    };
  } catch (err: any) {
    logger.error(`[PuppeteerScraper] Upwork scrape failed for ${profileUrl}: ${err.message}`);
    throw err;
  } finally {
    await page.close();
  }
}

/**
 * Scrape a provider profile from any supported marketplace.
 * Automatically detects the platform from the URL.
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

  throw new Error(`Unsupported marketplace URL: ${profileUrl}. Supported: fiverr.com, taskrabbit.com, upwork.com`);
}

/**
 * Scrape multiple provider profiles and ingest them all into Pabandi.
 * Returns ingestion results for each.
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
        source: scraped.source as ExternalProviderProfile['source'],
        sourceId: scraped.sourceId,
        name: scraped.name,
        handle: scraped.handle,
        bio: scraped.bio,
        location: scraped.location,
        websiteUrl: scraped.websiteUrl,
        avatarUrl: scraped.avatarUrl,
        hourlyRate: scraped.hourlyRate,
        currency: scraped.currency,
        skills: scraped.skills,
        category: scraped.category,
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

      // Polite delay between scrapes
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err: any) {
      errors.push({ url, error: err.message });
      logger.error(`[PuppeteerScraper] Failed to scrape and ingest ${url}: ${err.message}`);
    }
  }

  return { ingested, errors };
}

export const marketplaceScraper = {
  scrapeFiverrProfile,
  scrapeTaskRabbitProfile,
  scrapeUpworkProfile,
  scrapeMarketplaceProfile,
  scrapeAndIngestProfiles,
  closeScraperBrowser,
};
