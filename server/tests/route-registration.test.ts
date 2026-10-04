import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Structural guards on route registration.
 *
 * WHY SOURCE INSPECTION RATHER THAN HTTP CALLS
 * --------------------------------------------
 * Every one of these defects was invisible to the 622-test suite, because the tests call
 * route modules directly and never go through the registration list in src/index.ts. The
 * dead `/api/v1/whatsapp` entry shipped a 500 on every WhatsApp endpoint in production
 * while all tests passed, twice: once when it was added and once after I had worked
 * around the symptom in other files.
 *
 * So this asserts on the wiring itself. That is normally a poor thing to test — it breaks
 * on harmless refactors — but "every lazily-registered module exists on disk" and "no
 * prefix is registered twice" are properties of the wiring that no amount of unit testing
 * can reach, and both have a body count here of exactly one real defect.
 */

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
const indexSrc = readFileSync(join(serverRoot, 'src', 'index.ts'), 'utf8');

/** Every `lazyRoute('/path', './module')` style registration. */
function lazyRegistrations(): Array<{ prefix: string; module: string }> {
  const out: Array<{ prefix: string; module: string }> = [];
  const re = /\[\s*`([^`]+)`\s*,\s*'([^']+)'\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(indexSrc)) !== null) {
    out.push({ prefix: m[1], module: m[2] });
  }
  return out;
}

describe('every lazily registered route module exists', () => {
  const registrations = lazyRegistrations();

  it('found the registrations to check', () => {
    // If the pattern ever stops matching, this file silently checks nothing.
    expect(registrations.length).toBeGreaterThan(20);
  });

  it('no registration points at a file that is not there', () => {
    const missing = registrations
      .map((r) => ({ ...r, resolved: join(serverRoot, 'src', r.module.replace(/^\.\//, '')) }))
      .filter((r) => !existsSync(`${r.resolved}.ts`) && !existsSync(`${r.resolved}.js`))
      .map((r) => `${r.prefix} -> ${r.module}`);

    // This is the regression: `whatsapp.routes` never existed, and because routes mount
    // with app.use it broke every /api/v1/whatsapp/** endpoint in production.
    expect(missing).toEqual([]);
  });
});

describe('a broken registration must not have children', () => {
  const registrations = lazyRegistrations();
  const missing = (module: string) =>
    !existsSync(`${join(serverRoot, 'src', module.replace(/^\.\//, ''))}.ts`) &&
    !existsSync(`${join(serverRoot, 'src', module.replace(/^\.\//, ''))}.js`);

  it('names the case that actually breaks routes', () => {
    // A prefix that shadows another is NOT on its own a defect, and asserting that it
    // was produced 24 false positives on first run: `app.use('/a', …)` matches `/a/b`,
    // but the stub delegates with `next()`, so the child router is still reached. The
    // WhatsApp case was fatal for a different reason — the parent module FAILED TO LOAD,
    // so it never delegated.
    //
    // So the property worth asserting is the compound one: a registration whose module is
    // missing, and which has children, takes those children down with it.
    const culprits: string[] = [];
    for (const a of registrations) {
      if (!missing(a.module)) continue;
      const pa = a.prefix.replace('/${v}', '/:v');
      const children = registrations
        .filter((b) => b !== a && b.prefix.replace('/${v}', '/:v').startsWith(`${pa}/`))
        .map((b) => b.prefix);
      culprits.push(`${a.prefix} -> ${a.module} takes down ${children.length} route(s)`);
    }
    expect(culprits).toEqual([]);
  });
});

describe('WhatsApp routes are authenticated', () => {
  const advanced = readFileSync(join(serverRoot, 'src', 'routes', 'whatsapp.advanced.routes.ts'), 'utf8');

  it('requires a session', () => {
    // Unblocking these routes without auth would have turned a broken endpoint into an
    // open one that sends real WhatsApp messages to real phone numbers.
    expect(advanced).toMatch(/authenticate/);
  });

  it('refuses when the caller has no business', () => {
    expect(advanced).toMatch(/resolvePlatformBusinessId/);
  });

  it('is registered under /whatsapp/advanced', () => {
    const registrations = lazyRegistrations();
    expect(
      registrations.some((r) => r.prefix.endsWith('/whatsapp/advanced') && r.module.includes('whatsapp.advanced')),
    ).toBe(true);
  });

  it('no longer registers the module that does not exist', () => {
    expect(lazyRegistrations().some((r) => r.module.includes('routes/whatsapp.routes'))).toBe(false);
  });
});
