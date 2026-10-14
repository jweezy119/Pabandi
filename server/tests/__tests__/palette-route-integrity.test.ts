import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Navigation targets that rot.
 *
 * The original CommandPalette had twenty commands and two of them pointed at routes
 * that do not exist: `/wallet` has no route at all, and the real settings page is
 * `/contact/settings`, not `/settings`. Choosing them navigated nowhere.
 *
 * Nothing caught it, because a navigation target is a string. Nothing can catch it at
 * the type level either — `navigate('/anything')` typechecks perfectly.
 *
 * So this reads the real route table out of App.tsx and checks every palette command
 * against it. When a route is renamed or deleted, this fails and names the command.
 * Without it, the next person to move a page leaves a silent dead entry behind, which
 * is exactly how the original two got there.
 */

// This file lives at server/tests/__tests__/, so the client is three levels up.
const CLIENT_SRC = resolve(__dirname, '../../../client/src');
const appSource = readFileSync(resolve(CLIENT_SRC, 'App.tsx'), 'utf8');
const paletteSource = readFileSync(resolve(CLIENT_SRC, 'components/CommandPalette.tsx'), 'utf8');
const shortcutsSource = readFileSync(resolve(CLIENT_SRC, 'hooks/useKeyboardShortcuts.ts'), 'utf8');

/**
 * Every literal `path="..."` in App.tsx, normalised to a leading slash.
 *
 * Routes are declared without a leading slash and nest under parent paths, so this
 * is a prefix match against the declared table rather than an exact-set comparison:
 * a palette entry is valid when some declared route is a prefix of it.
 */
function declaredRoutes(): string[] {
  const paths = [...appSource.matchAll(/path="([^"]*)"/g)].map((m) => m[1]);
  return [...new Set(paths.map((p) => (p.startsWith('/') ? p : `/${p}`)))];
}

/** Does a `/a/b/c` navigation target resolve to any declared route? */
function routeExists(target: string, routes: string[]): boolean {
  const t = target.replace(/\/$/, '');
  return routes.some((r) => {
    const route = r.replace(/\/$/, '');
    return t === route || t.startsWith(route + '/');
  });
}

/**
 * Source with comments removed.
 *
 * These assertions are about what the code does. Checking the raw text also matches
 * prose — the file that documents the old `console.log('Cmd+K pressed')` mentions it in
 * its header, and would then fail a test asserting that string is gone. That is the
 * wrong reason for a test to fail, and it is the kind of failure that trains people to
 * delete useful comments.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('command palette navigation targets', () => {
  const routes = declaredRoutes();

  it('found a route table to check against', () => {
    // Guards the guard: if App.tsx ever moves or the regex stops matching, every
    // assertion below would pass vacuously.
    expect(routes.length).toBeGreaterThan(50);
  });

  const commands = [...paletteSource.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);

  it('has commands to check', () => {
    expect(commands.length).toBeGreaterThan(5);
  });

  it.each(commands)('command target %s exists as a route', (target) => {
    expect(routeExists(target, routes)).toBe(true);
  });

  it('points at the CRM, not only at the crypto side of the product', () => {
    // The original palette had twenty commands and not one of them pointed at the
    // CRM — the entire surface someone actually works in was absent.
    const contact = commands.filter((c) => c.startsWith('/contact'));
    expect(contact.length).toBeGreaterThanOrEqual(8);
  });
});

describe('keyboard shortcut navigation targets', () => {
  const routes = declaredRoutes();

  const targets = [...shortcutsSource.matchAll(/go\('([^']+)'\)/g)].map((m) => m[1]);

  it('has targets to check', () => {
    expect(targets.length).toBeGreaterThan(3);
  });

  it.each(targets)('shortcut target %s exists as a route', (target) => {
    expect(routeExists(target, routes)).toBe(true);
  });

  it('opens a palette on ⌘K rather than logging it', () => {
    const src = code(shortcutsSource);
    expect(src).toContain('onOpenPalette()');
    // The original did `console.log('Cmd+K pressed')` with a comment about opening a
    // modal "if one exists".
    expect(src).not.toContain("console.log('Cmd+K");
  });

  it('ignores keystrokes while the user is typing', () => {
    // Without this, selecting a note and typing "c" navigates away and loses it.
    const src = code(shortcutsSource);
    expect(src).toMatch(/INPUT/);
    expect(src).toMatch(/isContentEditable/);
  });
});

describe('command palette behaviour', () => {
  const palette = paletteSource;

  it('renders results as options and closes on Escape', () => {
    expect(palette).toContain('role="listbox"');
    expect(palette).toContain("e.key === 'Escape'");
  });

  it('treats a failed search as distinct from no matches', () => {
    // Conflating them tells someone a client does not exist because the request broke.
    const src = code(palette);
    expect(src).toContain('searchFailed');
    expect(src).toMatch(/Search could not be reached/);
  });

  it('does not claim to open on ⌘K — the shell does that', () => {
    // It must not close on ⌘K, which is what the original did: it called onClose(), so
    // the palette could only ever be dismissed.
    const src = code(palette);
    const keydownBlock = src.slice(src.indexOf('const onKeyDown'));
    expect(keydownBlock).not.toMatch(/metaKey.*'k'/);
  });

  it('returns focus to where the user was when it closes', () => {
    expect(palette).toContain('restoreFocusTo');
  });

  it('is reachable from the CRM shell', () => {
    const layout = readFileSync(resolve(CLIENT_SRC, 'components/DashboardLayout.tsx'), 'utf8');
    expect(layout).toContain('<CommandPalette');
    expect(layout).toContain('useKeyboardShortcuts');
  });
});