import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Navigation targets must exist.
 *
 * The Business OS workspace grid renders every module from
 * `config/businessModules.ts` and navigates to `descriptor.route` when clicked.
 * Five of the six pointed at `/crm/<key>`, and App.tsx registered none of those
 * paths — so a customer clicking "Bookings" got a blank page.
 *
 * This reads both files and checks every module route against the actual route
 * table. That is the only assertion shape that works here: a test that checked the
 * config in isolation passed happily while every route pointed nowhere, which is
 * exactly the bug.
 *
 * Null routes are legitimate and mean "no page yet" — the card renders
 * unavailable. What is forbidden is a route string that resolves to nothing.
 */

// This test lives under server/ but reads the CLIENT app, so paths are relative to
// the repo root rather than to this file.
const read = (fromRepoRoot: string) =>
  readFileSync(new URL(`../../${fromRepoRoot}`, import.meta.url), 'utf8');

const MODULES = 'client/src/config/businessModules.ts';
const APP = 'client/src/App.tsx';
const SHELL = 'client/src/pages/business-os/BusinessWorkspaceShell.tsx';

/** Every `path="..."` the SPA registers. */
function spaRoutes(): string[] {
  return [...read(APP).matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
}

/** Route values declared on module descriptors, with the label they belong to. */
function moduleRoutes(): Array<{ key: string; label: string; route: string | null }> {
  const src = read(MODULES);
  const out: Array<{ key: string; label: string; route: string | null }> = [];
  // Descriptors are object literals: { id: 'x', key: 'x', label: 'X', ..., route: '...' }
  for (const block of src.split(/\n  \{\n/).slice(1)) {
    const key = block.match(/\bkey:\s*'([^']+)'/)?.[1];
    const label = block.match(/\blabel:\s*'([^']+)'/)?.[1];
    if (!key || !label) continue;
    const routeMatch = block.match(/\broute:\s*(null|'([^']*)')/);
    if (!routeMatch) continue;
    out.push({ key, label, route: routeMatch[1] === 'null' ? null : routeMatch[2] });
  }
  return out;
}

describe('Business OS module navigation targets', () => {
  const modules = moduleRoutes();
  const routes = spaRoutes();

  it('finds the module descriptors', () => {
    // Guards the extractor: if this returns nothing every assertion below passes
    // vacuously, which is how the original test missed this entirely.
    expect(modules.length).toBeGreaterThanOrEqual(6);
  });

  it('every non-null module route is registered in App.tsx', () => {
    for (const m of modules) {
      if (m.route === null) continue;
      const path = m.route.replace(/^\//, '');
      expect(routes, `${m.label} -> ${m.route} is not a registered route`).toContain(path);
    }
  });

  it('no module points at the /crm/* tree, which was never routed', () => {
    // The whole defect in one assertion. /crm itself is a client route, so this
    // checks the specific broken shape: /crm/<key>.
    for (const m of modules) {
      if (m.route === null) continue;
      expect(m.route, `${m.label} points into the unrouted /crm/<key> tree`).not.toMatch(/^\/crm\/.+/);
    }
  });

  it('modules with no page declare a null route rather than a placeholder', () => {
    // Honest absence. A fake route would navigate somewhere and look built.
    for (const m of modules) {
      if (m.route !== null) continue;
      expect(m.route).toBeNull();
    }
  });

  it('the shell never navigates to a null route', () => {
    // The Open button is gated on status === 'ok', which now requires a route. The
    // guard inside onOpen is the second line of defence.
    const shell = read(SHELL);
    expect(shell).toMatch(/if \(descriptor\.route\) navigate\(descriptor\.route\)/);
  });

  it('a routeless module is reported unavailable rather than healthy', () => {
    const shell = read(SHELL);
    expect(shell).toMatch(/descriptor\.route \?/);
    // Match the idea, not an exact sentence: the copy is allowed to be reworded,
    // the behaviour (routeless => not ok) is not.
    expect(shell).toMatch(/page does not|does not exist|no page yet|not available in this app/i);
  });
});

describe('the live surface is the contact/* tree', () => {
  it('the routes modules now point at are real', () => {
    const routes = spaRoutes();
    // Every non-null module route was checked against the table above; this
    // asserts the specific set, so a future rename breaks loudly here rather
    // than in production navigation.
    for (const expected of ['contact', 'contact/money-flow', 'contact/invoices']) {
      expect(routes, `${expected} missing`).toContain(expected);
    }
  });
});