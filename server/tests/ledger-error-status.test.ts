import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A 403 wearing a 500's clothes.
 *
 * Reported as 500s on /capital/invoices, /capital/cashflow and /capital/accounts.
 * They were not server faults.
 *
 * `requireBusinessId` throws `CustomError('No business is associated with this
 * account', 403)` when the token carries no businessId — which is exactly the
 * state a session is in between registering and enrolling a business, and the
 * state any session minted before enrollment stays in.
 *
 * Every ledger handler then caught that with a blanket `catch` and answered:
 *
 *     500 { error: "Failed to list invoices" }
 *
 * So a permission answer was reported as a broken database, on every capital
 * endpoint, with a message naming a table the request never reached. Someone
 * debugging that has no way to get from "Failed to list invoices" to "this
 * account has no business on its token" — which is the whole fix.
 *
 * The lesson is not "check status codes". It is that a catch block is a decision
 * about what an error *is*, and a blanket one throws that decision away.
 */

const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

describe('ledger routes report the status the error has', () => {
  const ledger = src('src/routes/ledger.routes.ts');

  it('has a helper that preserves a CustomError status', () => {
    expect(ledger).toMatch(/function fail\(/);
    expect(ledger).toMatch(/if \(e instanceof CustomError\)[\s\S]{0,120}statusCode/);
  });

  it('does not flatten the tenant check into a 500', () => {
    // The exact anti-pattern: a handler that calls requireBusinessId and then
    // answers every failure with 500.
    const handlers = // Non-capturing group: a capturing one interleaves the verbs into the segments,
    // so slice(1) yields 'get', not a handler body.
    ledger.split(/^router\.(?:get|post|patch|delete)\(/m).slice(1);
    expect(handlers.length, 'no handlers parsed — the regex is wrong').toBeGreaterThan(5);

    // One handler here (`/expenses/categories`) is a static lookup with no tenant
    // at all, so it is skipped rather than asserted into shape.
    const tenantScoped = handlers.filter((h) => h.includes('requireBusinessId'));
    expect(tenantScoped.length, 'no tenant-scoped handlers found — the regex is wrong')
      .toBeGreaterThan(5);

    for (const handler of tenantScoped) {
      expect(handler, 'a tenant-scoped handler still answers 500 directly')
        .not.toMatch(/res\.status\(500\)\.json/);
    }
  });

  it('routes every catch through the helper', () => {
    const catches = ledger.match(/catch \(e\) \{/g) || [];
    expect(catches.length).toBeGreaterThan(5);
    expect(ledger.match(/fail\(res, e,/g) || []).toHaveLength(catches.length);
  });

  it('keeps an unexpected failure as a 500, and logged', () => {
    // Not everything should become a 4xx. A real fault must still be a 500 so it
    // is visible as one, and must still be logged with its message.
    expect(ledger).toMatch(/logger\.error\(/);
    expect(ledger).toContain("return res.status(500).json({ success: false, error: fallback });");
  });
});

describe('the tenant check itself is unchanged', () => {
  const ledger = src('src/routes/ledger.routes.ts');

  it('still refuses an account with no business, with a 403', () => {
    // The fix is in how the error is REPORTED, not in whether it is raised.
    // Weakening this to make the 500 go away would be the wrong trade.
    expect(ledger).toMatch(
      /throw new CustomError\('No business is associated with this account',\s*403\)/,
    );
  });

  it('accepts either the current or the legacy claim', () => {
    // activeBusinessId is the old name for the same value; older tokens carry only
    // that, and dropping it would lock those sessions out of their own books.
    expect(ledger).toMatch(/req\.user\?\.businessId \?\? req\.user\?\.activeBusinessId/);
  });
});

describe('the same trap elsewhere', () => {
  it('task update answers a tenant failure with its own status', () => {
    const tasks = src('src/routes/task.routes.ts');
    expect(tasks).toMatch(/catch \(err\) \{[\s\S]{0,400}if \(err instanceof CustomError\)/);
  });

  it('the subscription webhook keeps its 500 on purpose', () => {
    // Not a bug, and deliberately left alone: the provider retries a 5xx, so
    // converting it to a 403 would stop a retry that should happen.
    const subs = src('src/routes/subscription.routes.ts');
    expect(subs).toMatch(/return res\.status\(500\)\.json\(\{ success: false, error: 'Handler error' \}\)/);
  });
});