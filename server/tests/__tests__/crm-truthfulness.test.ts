import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Things the CRM told people that were not true.
 *
 * Each of these shipped, and each failed quietly — no error, no empty state, no
 * broken render. They were worse than missing features because they were confident.
 *
 *   - "Active Deals" counted CLIENTS with stage 'booked'. A business with one open
 *     deal and forty booked clients was shown "40 active deals".
 *   - "Recent Clients" rendered every client the tenant had, uncapped, under a
 *     heading claiming recency.
 *   - "Connect Personally" called alert('Invitation sent!') and sent nothing. There
 *     is no system behind it: Connection links one User to another and a CrmClient
 *     has no userId.
 *   - "Share Trust Profile" awaited nothing and caught nothing, then reported success
 *     unconditionally — so a rejected clipboard write still said "copied".
 *   - trust-core's calculateScore returned a literal 500, which is the midpoint of its
 *     0-1000 scale and so looks like a real, moderate score.
 *   - jobCronService.processOverdueJobs was an empty method that ran every minute.
 *
 * A button that says "Invitation sent!" when nothing was sent teaches the user that
 * the CRM cannot be trusted, which is the one thing this whole pass has been trying to
 * undo. These assertions exist so the next one is a test failure rather than a bug
 * report.
 */

const CLIENT_SRC = resolve(__dirname, '../../../client/src');
const SERVER_SRC = resolve(__dirname, '../../src');

function read(file: string, root = CLIENT_SRC): string {
  return readFileSync(resolve(root, file), 'utf8');
}

/** Source with comments removed, so documentation of the old bug is not a match. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('no alert() dialogs in the CRM', () => {
  const pages = [
    'pages/contact/ContactClientDetailPage.tsx',
    'pages/contact/ContactOSPage.tsx',
    'pages/crm/ContactTeamPage.tsx',
    'pages/contact/ContactClientsPage.tsx',
    'pages/contact/ContactDealsPage.tsx',
    'pages/crm/ContactTasksPage.tsx',
    'pages/crm/ContactInvoiceDetailPage.tsx',
  ];

  it.each(pages)('%s contains no alert()', (page) => {
    // `alert` here is both unfashionable and, more to the point, uninterruptible
    // feedback: it cannot say which of several outcomes happened, and it cannot be
    // styled or dismissed politely.
    expect(code(read(page))).not.toMatch(/\balert\s*\(/);
  });
});

describe('the dashboard counts what it says it counts', () => {
  const page = code(read('pages/contact/ContactOSPage.tsx'));

  it('Active Deals is computed from deals, not from clients', () => {
    // The old expression was leads.filter(l => l.stage === 'booked').length, which
    // counts clients and calls them deals.
    expect(page).not.toMatch(/leads\.filter\([^)]*\)[^;]*Active Deals/);
    expect(page).toMatch(/deals\.filter\(\(d\) => d\.stage !== 'WON'/);
  });

  it('Active Deals excludes only the terminal stages', () => {
    // Filtering on an "open stages" list instead would break whenever the pipeline is
    // customised, which is why the stages page is deliberately read-only.
    expect(page).toMatch(/d\.stage !== 'WON' && d\.stage !== 'LOST'/);
  });

  it('Recent Clients is sorted newest-first and capped', () => {
    expect(page).toMatch(/recentClients[\s\S]*\.slice\(0,\s*\d+\)/);
    expect(page).not.toMatch(/\{leads\.map\(/);
  });
});

describe('the share button reports what actually happened', () => {
  const page = code(read('pages/contact/ContactClientDetailPage.tsx'));

  it('awaits the clipboard write', () => {
    // writeText returns a promise that rejects on a denied permission or an insecure
    // context. Not awaiting it means the success path always runs.
    expect(page).toMatch(/await navigator\.clipboard\.writeText/);
  });

  it('catches a failure and says so', () => {
    expect(page).toMatch(/catch[\s\S]*setShareState\('failed'\)/);
    expect(page).toMatch(/'copied'/);
  });

  it('does not offer Connect Personally', () => {
    // Connection links User to User. A CrmClient has no userId, so there is no row
    // this could ever create.
    expect(code(read('pages/contact/ContactClientDetailPage.tsx'))).not.toContain('Connect Personally');
  });
});

describe('trust-core returns no invented numbers', () => {
  it('calculateScore is gone rather than returning a constant', () => {
    const src = code(read('trust/trust-core.ts', SERVER_SRC));
    expect(src).not.toContain('calculateScore');
  });

  it('no method returns a bare constant where a computation belongs', () => {
    const src = read('trust/trust-core.ts', SERVER_SRC);
    // `return 500;` looked exactly like a real midpoint score on this system's
    // 0-1000 scale. The general shape is what matters here, not the specific number.
    expect(src).not.toMatch(/async\s+\w+\([^)]*\)\s*:\s*Promise<number>\s*\{\s*return\s+\d+\s*;\s*\}/);
  });
});

describe('the job cron does not run empty methods', () => {
  const cron = code(read('services/jobCronService.ts', SERVER_SRC));

  it('no private method is an empty body', () => {
    expect(cron).not.toMatch(/private\s+async\s+\w+\([^)]*\)\s*\{\s*\}/);
  });

  it('the stalled check-in detection is not here any more', () => {
    // It lives in alerts.service.generateAlerts, which persists and notifies. This
    // file ran it every minute and did nothing.
    expect(cron).not.toContain('processOverdueJobs');
  });
});

describe('stalled check-ins are detected', () => {
  const alerts = code(read('services/alerts.service.ts', SERVER_SRC));

  it('raises an alert for a job checked in and never out', () => {
    expect(alerts).toMatch(/status !== 'IN_PROGRESS'/);
    expect(alerts).toMatch(/Stalled job/);
  });

  it('measures from the check-in rather than the schedule', () => {
    // Anchoring on the schedule produced a future "finish" time for a job checked in
    // after its slot, so elapsed came out negative and the rule never fired at all.
    expect(alerts).toMatch(/now\.getTime\(\) - job\.checkedInAt\.getTime\(\)/);
    expect(alerts).not.toContain('composeJobStart');
  });

  it('never closes the job itself', () => {
    // Asserted structurally: the rule reads jobs and pushes alerts, and the module
    // has no write to crmJob at all.
    expect(alerts).not.toMatch(/crmJob\.(update|updateMany|delete)/);
    expect(alerts).toMatch(/entityType: 'job'/);
  });
});