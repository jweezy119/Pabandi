import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Where the customer-facing magic links are mounted.
 *
 * ─── THE REGRESSION ─────────────────────────────────────────────────────────
 * `/invoice/:id`, `/pay/:invoiceId` and `/b/:id` were declared INSIDE the
 * `<Route element={<AppShellLayout />}>` group, whose first line is
 *
 *     if (!isAuthenticated) return <Navigate to="/login" replace />;
 *
 * A business sent an invoice; the customer clicked the link; they landed on the
 * sign-in page. Verified against production with curl and a browser, all three
 * paths redirected to /login.
 *
 * Nothing else in the codebase was wrong: MagicLinkPage lives in `pages/public`,
 * renders its own full-screen shell, and calls only unauthenticated endpoints
 * (/api/v1/public/magic/:id and /api/v1/public/invoices/:id) — both confirmed
 * returning 200 JSON with no Authorization header. The router alone refused to
 * show a page that works without a session.
 *
 * ─── WHY THIS READS SOURCE RENDER THAN MOUNTING THE APP ──────────────────────
 * The defect is *placement* in App.tsx, so that is what is asserted. Mounting the
 * whole app would pull in every lazy page, the auth store and the API client, and
 * would test a great deal more than the claim being made.
 */

const APP = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
const LINES = APP.split('\n');

/** Inclusive 0-based span of a layout group opened by `marker`. */
function groupSpan(marker: string): { start: number; end: number } {
  const start = LINES.findIndex((l) => l.includes(marker));
  expect(start, `${marker} must exist`).toBeGreaterThanOrEqual(0);

  // The group closes at the first standalone </Route> after it. There is no nested
  // `<Route element={...}>` inside either group, so a standalone closer is the
  // group's own.
  const end = LINES.findIndex((l, i) => i > start && l.trim() === '</Route>');
  expect(end, `${marker} must be closed`).toBeGreaterThan(start);
  return { start, end };
}

function lineOf(routePath: string): number {
  const idx = LINES.findIndex((l) => l.includes(`path="${routePath}"`));
  expect(idx, `App.tsx must declare ${routePath}`).toBeGreaterThanOrEqual(0);
  return idx;
}

describe('customer-facing magic links', () => {
  const shell = groupSpan('<Route element={<AppShellLayout />}>');

  for (const routePath of ['b/:id', 'pay/:invoiceId', 'invoice/:id']) {
    it(`mounts ${routePath} OUTSIDE AppShellLayout, so a signed-out customer can open it`, () => {
      const at = lineOf(routePath);
      // Inside the span means an anonymous visitor is bounced to /login before the
      // page ever renders — the exact production behaviour this guards against.
      const inside = at > shell.start && at < shell.end;
      expect(
        inside,
        `${routePath} is inside AppShellLayout (lines ${shell.start + 1}-${shell.end + 1}); ` +
          'an anonymous customer clicking an invoice link would be sent to /login',
      ).toBe(false);
    });
  }

  it('keeps the magic links out of the authenticated marketing Layout too', () => {
    // MagicLinkPage draws its own full-screen shell; wrapping it in <Layout> would
    // put marketing chrome around a self-contained payment screen.
    const layout = groupSpan('<Route element={<Layout />}>');
    for (const routePath of ['b/:id', 'pay/:invoiceId', 'invoice/:id']) {
      const at = lineOf(routePath);
      expect(at > layout.start && at < layout.end, `${routePath} should sit beside /verify-trust`).toBe(false);
    }
  });

  it('leaves the authenticated surfaces gated, so this is not a blanket opening', () => {
    // The fix moves three routes; it must not have neutered the gate itself.
    expect(APP).toContain('if (!isAuthenticated) return <Navigate to="/login" replace />;');
    expect(APP).toContain('<Route element={<AppShellLayout />}>');
  });
});
