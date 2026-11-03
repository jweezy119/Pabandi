import { fetch } from 'undici';
import { resolve, resolve4, resolve6, type RecordWithTtl } from 'dns';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';

const resolve4Async = promisify(resolve4);
const resolve6Async = promisify(resolve6);

interface DnsResult {
  a: string[];
  aaaa: string[];
}

interface TechSignal {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

interface EnrichResult {
  domain: string;
  isActive: boolean;
  dns?: DnsResult;
  emails: string[];
  techStack: string[];
  socials: { linkedin?: string; twitter?: string; facebook?: string };
  error?: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const PRIORITY_EMAILS = ['sales@', 'info@', 'hello@', 'contact@', 'support@'];

const TECH_SIGNALS: Array<{ name: string; patterns: RegExp[]; headers?: Record<string, RegExp | string> }> = [
  {
    name: 'WordPress',
    patterns: [/wp-content/, /wp-includes/, /wordpress/, /wp-json/],
    headers: { 'x-powered-by': /php/i },
  },
  {
    name: 'Shopify',
    patterns: [/shopify/, /cdn\.shopify\.com/, /shopify\.cdn/],
  },
  {
    name: 'React',
    patterns: [/react/, /_next\/static/],
    headers: { 'x-powered-by': /next/i },
  },
  {
    name: 'Next.js',
    patterns: [/_next\/static/, /__next__/],
    headers: { 'x-powered-by': /next/i },
  },
  {
    name: 'HubSpot',
    patterns: [/hsforms/, /hubspot/, /hs-script/],
  },
  {
    name: 'WooCommerce',
    patterns: [/woocommerce/, /wc-blocks/],
  },
  {
    name: 'Squarespace',
    patterns: [/squarespace/, /static1\.squarespace/],
  },
  {
    name: 'Wix',
    patterns: [/wix\.com/, /wixcode/],
  },
  {
    name: 'Webflow',
    patterns: [/webflow/, /webflow\.com/],
  },
  {
    name: 'Google Analytics',
    patterns: [/gtag\(/, /google-analytics\.com\/analytics\.js/, /googletagmanager/],
  },
  {
    name: 'Facebook Pixel',
    patterns: [/fbq\(/, /facebook\.net\/tr\.js/],
  },
];

const SOCIAL_PATTERNS: Array<{ key: 'linkedin' | 'twitter' | 'facebook'; pattern: RegExp }> = [
  { key: 'linkedin', pattern: /linkedin\.com\/(company|in)\/[^"'\s<>]+/i },
  { key: 'twitter', pattern: /(?:twitter|x)\.com\/[^"'\s<>]+/i },
  { key: 'facebook', pattern: /facebook\.com\/[^"'\s<>]+/i },
];

function sortEmails(emails: string[]): string[] {
  const priority = [...PRIORITY_EMAILS];
  const rest = emails.filter(
    (e) => !priority.some((p) => e.toLowerCase().startsWith(p)),
  );
  const ordered = priority
    .flatMap((p) => emails.filter((e) => e.toLowerCase().startsWith(p)))
    .filter((v, i, a) => a.indexOf(v) === i);
  return [...ordered, ...rest.filter((v, i, a) => a.indexOf(v) === i)];
}

function detectTech(html: string, headers: Record<string, string>): string[] {
  const found: string[] = [];
  for (const signal of TECH_SIGNALS) {
    let matched = false;
    for (const pat of signal.patterns) {
      if (pat.test(html)) {
        matched = true;
        break;
      }
    }
    if (!matched && signal.headers) {
      for (const [header, valPat] of Object.entries(signal.headers)) {
        const hv = headers[header.toLowerCase()] || headers[header];
        if (hv) {
          const matches = valPat instanceof RegExp ? valPat.test(hv) : hv.includes(valPat);
          if (matches) {
            matched = true;
            break;
          }
        }
      }
    }
    if (matched) found.push(signal.name);
  }
  return found;
}

function extractSocials(html: string): { linkedin?: string; twitter?: string; facebook?: string } {
  const socials: { linkedin?: string; twitter?: string; facebook?: string } = {};
  for (const sp of SOCIAL_PATTERNS) {
    const m = html.match(sp.pattern);
    if (m) {
      let url = m[0];
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      if (sp.key === 'linkedin') socials.linkedin = url;
      else if (sp.key === 'twitter') socials.twitter = url;
      else if (sp.key === 'facebook') socials.facebook = url;
    }
  }
  return socials;
}

async function resolveDns(domain: string): Promise<DnsResult | undefined> {
  try {
    const [a, aaaa] = await Promise.allSettled([
      resolve4Async(domain),
      resolve6Async(domain),
    ]);
    return {
      a: a.status === 'fulfilled' ? (a.value as string[]) : [],
      aaaa: aaaa.status === 'fulfilled' ? (aaaa.value as string[]) : [],
    };
  } catch {
    return undefined;
  }
}

async function fetchHtml(url: string): Promise<{ html: string; headers: Record<string, string> } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PabandiCompanyIntel/1.0; +https://pabandi.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      return null; // blocked / rate limited
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const html = await res.text();
    return { html, headers };
  } catch {
    return null;
  }
}

export class CompanyIntelService {
  async enrichCompany(domain: string): Promise<EnrichResult> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];

    // 1) DNS check — confirm domain is active
    let dns: DnsResult | undefined;
    try {
      dns = await resolveDns(cleanDomain);
    } catch {
      dns = undefined;
    }
    const isActive = Boolean(dns?.a.length || dns?.aaaa.length);

    // 2) Scrape homepage and contact page
    const home = await fetchHtml(`https://${cleanDomain}`);
    const contact = await fetchHtml(`https://${cleanDomain}/contact`);

    if (!home && !contact) {
      return {
        domain: cleanDomain,
        isActive: false,
        emails: [],
        techStack: [],
        socials: {},
        error: 'Blocked',
      };
    }

    const html = home ? home.html : '';
    const contactHtml = contact ? contact.html : '';
    const combinedHtml = html + '\n' + contactHtml;

    const headers = home ? home.headers : (contact ? contact.headers : {});

    // 3) Extract emails (prioritize sales@, info@, hello@)
    const emailSet = new Set<string>();
    for (const m of combinedHtml.matchAll(EMAIL_REGEX)) {
      emailSet.add(m[0].toLowerCase());
    }
    const emails = sortEmails([...emailSet]);

    // 4) Detect tech stack
    const techStack = detectTech(combinedHtml, headers);

    // 5) Extract socials
    const socials = extractSocials(combinedHtml);

    return {
      domain: cleanDomain,
      isActive,
      dns,
      emails,
      techStack,
      socials,
    };
  }
}

export const companyIntel = new CompanyIntelService();
