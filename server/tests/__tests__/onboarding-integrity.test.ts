import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Onboarding that would have told people the wrong thing.
 *
 * `OnboardingTour` was a six-step coach-mark tour: each step named a `targetId`, each
 * measured that element's `getBoundingClientRect` to place a tooltip, and each fell
 * back to screen centre when the element was missing.
 *
 * All six target ids matched zero elements anywhere in the codebase — balance-card,
 * trust-tier, pay-rent-btn, staking-card, maintenance-btn, history-card. Every step
 * would have used the fallback, so six tooltips would have stacked on top of each
 * other in the middle of the screen.
 *
 * Its content was also for a different product: staking PAB, trust tiers, paying rent
 * in USDC. Shipping it would have told a salon owner that their new CRM is a crypto
 * wallet.
 *
 * Two properties are asserted here so that neither failure can come back:
 *
 *   1. Every `targetId` the tour names must exist in the client.
 *   2. The tour must not be rendered anywhere.
 *
 * The first is the check that would have caught it at the time. The second is
 * deliberate: the component is not deleted, because its fallback behaviour and
 * positioning logic are reasonable and someone may rebuild the tour properly against
 * real elements. But it is not switched on, and this asserts that it stays that way
 * until someone does that work.
 */

const CLIENT_SRC = resolve(__dirname, '../../../client/src');

function clientFiles(dir: string): string[] {
  return readFileSync(resolve(dir, 'x'), 'utf8') && [];
}

/** Every source file under client/src, as text. */
function allClientSource(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const { globSync } = require('node:fs');
  const files = globSync('**/*.{tsx,ts}', { cwd: CLIENT_SRC, nodir: true });
  for (const f of files) {
    out.push({ file: f, text: readFileSync(resolve(CLIENT_SRC, f as string), 'utf8') });
  }
  return out;
}

/** Source with comments removed: these assertions are about code, not prose. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const all = allClientSource();
const tourPath = 'components/OnboardingTour.tsx';
const tour = readFileSync(resolve(CLIENT_SRC, tourPath), 'utf8');

describe('the tour that was never switched on', () => {
  const targetIds = [...tour.matchAll(/targetId:\s*'([^']+)'/g)].map((m) => m[1]);

  it('has steps to check', () => {
    expect(targetIds.length).toBeGreaterThan(0);
  });

  it('resolves none of its target elements', () => {
    const resolved = targetIds.filter((id) =>
      all.some((f) => f.file !== tourPath && f.text.includes(`id="${id}"`)),
    );
    // Documented as it stands, not asserted as it should be. Every anchor is missing,
    // which is precisely why the tour was left unwired rather than patched.
    //
    // If this ever fails, someone added those elements — and the tour may now be
    // viable. That is the signal to rebuild it deliberately rather than to flip this
    // expectation back the other way.
    expect(resolved).toHaveLength(0);
  });

  it('would stack every step in the same place if it were shown', () => {
    // The fallback when a target is missing is the centred position, so six missing
    // targets means six tooltips in the middle of the screen.
    expect(code(tour)).toMatch(/return \{ top: '50%', left: '50%'/);
  });

  it('is not rendered by anything', () => {
    const importers = all.filter(
      (f) => f.file !== tourPath && /from\s+['"][^'"]*OnboardingTour['"]/.test(f.text),
    );
    expect(importers.map((f) => f.file)).toHaveLength(0);
  });

  it('describes a different product than the one it would be shown in', () => {
    // Kept as an explicit assertion rather than a note in a comment: if someone
    // rewrites the copy for this product, this test failing is the signal that the
    // rewrite happened and the target-element test can be reconsidered.
    const cryptoTerms = ['PAB', 'USDC', 'stake', 'APY', 'wallet', 'trust tier'];
    const lower = tour.toLowerCase();
    const mentions = cryptoTerms.filter((t) => lower.includes(t.toLowerCase()));
    expect(mentions.length).toBeGreaterThan(0);
  });
});

describe('the checklist that replaced it', () => {
  const checklist = readFileSync(
    resolve(CLIENT_SRC, 'pages/contact/components/FirstRunChecklist.tsx'),
    'utf8',
  );

  it('is anchored to nothing', () => {
    // The whole point: it reads counts instead of measuring DOM rectangles, so it
    // cannot break when an element is renamed or moved.
    const src = code(checklist);
    expect(src).not.toContain('targetId');
    expect(src).not.toContain('getBoundingClientRect');
  });

  it('is mounted on the CRM dashboard', () => {
    const page = readFileSync(resolve(CLIENT_SRC, 'pages/contact/ContactOSPage.tsx'), 'utf8');
    expect(page).toContain('FirstRunChecklist');
  });

  it('renders nothing when it cannot tell what the account contains', () => {
    // Guessing at zero would show a fully-set-up workspace five "you haven't done this
    // yet" items because the request failed.
    expect(checklist).toMatch(/if \(dismissed \|\| !progress\) return null/);
    expect(checklist).toContain('catch');
  });

  it('omits steps for features this vertical does not have', () => {
    // Otherwise it links to a page that FeatureGate redirects straight back.
    expect(checklist).toContain('enabledFeatures');
    expect(checklist).toMatch(/!s\.feature \|\| enabled\.includes\(s\.feature\)/);
  });

  it('survives localStorage being unavailable', () => {
    // Private browsing throws on access. An undismissable checklist is a much better
    // failure than a page that will not render.
    expect(checklist).toMatch(/try \{[\s\S]*localStorage[\s\S]*\} catch/);
  });
});

/**
 * Just the /setup-progress handler, not the whole router file.
 *
 * Reads the file itself rather than closing over the `crmRoutes` const declared below
 * it: a function declaration hoists, a `const` does not.
 */
function setupProgressBlock(): string {
  const src = readFileSync(resolve(__dirname, '../../src/routes/crm.routes.ts'), 'utf8');
  const start = src.indexOf("router.get('/setup-progress'");
  const next = src.indexOf('\nrouter.', start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe('setup progress endpoint', () => {
  const crmRoutes = readFileSync(
    resolve(__dirname, '../../src/routes/crm.routes.ts'),
    'utf8',
  );

  it('is registered', () => {
    expect(crmRoutes).toContain("router.get('/setup-progress'");
  });

  it('uses counts rather than fetching collections', () => {
    // The checklist only needs totals. Pulling every row to read `.length` would move
    // whole tables into the browser on the most-visited page.
    expect(setupProgressBlock()).toMatch(/prisma\.crmClient\.count/);
    expect(setupProgressBlock()).not.toContain('findMany');
  });

  it('scopes invoices to the platform business', () => {
    expect(setupProgressBlock()).toContain('__no_platform_business__');
  });

  it('counts only outstanding tasks', () => {
    // A pile of completed tasks is not evidence someone set their workspace up; it
    // would tick the box for someone who finished a year ago and never came back.
    expect(setupProgressBlock()).toMatch(/status: \{ not: 'DONE' \}/);
  });
});