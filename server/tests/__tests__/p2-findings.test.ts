import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * P2 findings, pinned.
 *
 * Three of these are things this work claimed or previously reported and they needed
 * checking rather than assuming — two of the claims turned out to be wrong, and the
 * assertions below record which.
 *
 *   1. `revenueForecasting.forecast()` falls back to reading the database with
 *      `features.businessId` when no history was supplied. That businessId comes from
 *      the request body and the route never checks it against the caller. It is safe
 *      today ONLY because the route rejects any body with fewer than three months of
 *      history, so the fallback is unreachable — the safety is incidental, not
 *      deliberate. If that validation is ever relaxed, it becomes a cross-tenant
 *      revenue read. This test fails loudly rather than leaving that to chance.
 *
 *   2. `businessOsService` was reported as "defined in the client and never called".
 *      Wrong. `BusinessWorkspaceShell` calls it, that shell is routed at
 *      `/business-os`, and the CRM nav links to it. All eleven nav targets resolve.
 *
 *   3. The escrow → job chain is dead at the root. The three event-bus subscribers
 *      that write `CrmJob.escrowStatus` are complete and correct, and nothing emits
 *      those events on that bus — the escrow services emit the same three names to the
 *      OTHER trust system. No escrow model anywhere links to a job.
 */

const SRC = resolve(__dirname, '../../src');
const CLIENT = resolve(__dirname, '../../../client/src');
const read = (p: string, root = SRC) => readFileSync(resolve(root, p), 'utf8');

describe('the revenue forecast cannot be turned into a cross-tenant read', () => {
  const service = read('services/ai/revenueForecasting.service.ts');
  const route = read('routes/aiBusiness.routes.ts');

  it('the service DOES read the database with a caller-supplied businessId', () => {
    // Stated plainly, because this is the dangerous shape and it still exists.
    expect(service).toMatch(/getHistoricalRevenue\(features\.businessId, 12\)/);
  });

  it('the route rejects any request that could reach it', () => {
    // This is the only thing standing between a body-supplied businessId and another
    // tenant's revenue history. It is the safety, so it is asserted.
    expect(route).toMatch(/input\.historicalData\.length < 3/);
  });

  it('the route always supplies the history the fallback would otherwise fetch', () => {
    // Both conditions: the body is validated AND mapped through, so the service's
    // `length === 0` branch cannot be taken through this route.
    expect(route).toMatch(/historicalRevenue: input\.historicalData\.map/);
    expect(route).toMatch(/historicalOrders: input\.historicalData\.map/);
  });
});

describe('businessOsService is reachable, contrary to an earlier claim', () => {
  const shell = read('pages/business-os/BusinessWorkspaceShell.tsx', CLIENT);
  const app = read('App.tsx', CLIENT);
  const layout = read('components/DashboardLayout.tsx', CLIENT);

  it('is called', () => {
    expect(shell).toMatch(/businessOsService\.modules\(\)/);
    expect(shell).toMatch(/businessOsService\.pulse\(/);
  });

  it('is routed', () => {
    expect(app).toMatch(/path="business-os"/);
  });

  it('is in the CRM nav', () => {
    expect(layout).toMatch(/path: '\/business-os'/);
  });

  it('every CRM nav target resolves to a declared route', () => {
    const declared = new Set<string>();
    for (const m of read('App.tsx', CLIENT).matchAll(/<Route\s+path="([^"]*)"/g)) {
      declared.add('/' + m[1].replace(/^\//, ''));
    }
    const targets = [...new Set([...layout.matchAll(/path: '([^']+)'/g)].map((m) => m[1]))];

    const missing = targets.filter(
      (t) => !declared.has(t) && ![...declared].some((d) => d.startsWith(t + '/')),
    );
    expect(missing).toEqual([]);
  });
});

describe('the escrow chain is documented as dead, not quietly live', () => {
  const trustCore = read('services/trust-core.service.ts');

  it('names the reason at the subscribers', () => {
    expect(trustCore).toMatch(/THE THREE SUBSCRIBERS BELOW ARE CURRENTLY UNREACHABLE/);
    // Specifically: two trust systems, same event names, two buses.
    expect(trustCore).toMatch(/Two trust systems with the same event names on two buses/);
  });

  it('records that no escrow model links to a job', () => {
    expect(trustCore).toMatch(/no escrow record that links to a job/i);
  });

  it('records the three things the dead chain silently disables', () => {
    // These are the consequences that would otherwise read as "working but empty".
    expect(trustCore).toMatch(/getClientStage/);
    expect(trustCore).toMatch(/alerts\.service/);
  });

  it('does not "fix" invoiceGeneration to match a value nothing writes', () => {
    // Changing 'FUNDED' to 'HELD' would make a dead branch look live while it still
    // could never fire. Left alone, with the reason.
    const inv = read('services/invoiceGeneration.service.ts');
    expect(inv).toMatch(/job\.escrowStatus === 'FUNDED'/);
    expect(inv).toMatch(/not a value anything writes/);
  });
});

describe('the trust insights chart does not lie about scale', () => {
  const widget = read('pages/crm/components/TrustInsightsWidget.tsx', CLIENT);

  it('scales bars against the largest band, not a hardcoded 20', () => {
    // A 200-client tenant had every band wider than 100%, so the chart said everyone
    // was in the same band — the opposite of what it appeared to show.
    expect(widget).not.toMatch(/\(count \/ 20\)/);
    expect(widget).toMatch(/count \/ peak/);
  });

  it('prints the absolute count beside every bar, so nothing depends on the scale', () => {
    expect(widget).toMatch(/aria-label=\{`\$\{count\} clients scoring \$\{band\}`\}/);
  });
});