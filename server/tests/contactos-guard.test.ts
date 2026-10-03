import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { effectiveMode, safeInternalPath } from '../../client/src/utils/accountMode';

/**
 * The ContactOS redirect loop.
 *
 * Symptom: tapping CRM "does not open correctly many times", and pressing Back
 * returns to the landing page again.
 *
 * Mechanism, in two parts:
 *
 *   1. `preferredMode` is optional on the user type. The server had a fix that adds
 *      it to the login payload, but nothing re-fetches the user on boot — there is
 *      no /me endpoint — so any session stored before that fix has it permanently
 *      undefined.
 *   2. BusinessGuard read `user?.preferredMode !== 'business'` and redirected to
 *      "/" with `replace`. undefined !== 'business' is true, so every ContactOS
 *      route bounced. `replace` destroyed the intended URL, so Back did not return
 *      to it — it returned to the landing page, which is the loop.
 *
 * Four other components (ModeToggle, ModuleSwitcher, AppShell, UserMenu) already
 * fell back to 'business'. The guard was the only place treating absence as
 * failure, so those users could see a CRM tab they could not open.
 */

describe('effectiveMode', () => {
  it('treats a missing mode as business, matching every other consumer', () => {
    // This is the fix. Previously BusinessGuard treated undefined as a failure and
    // bounced the user; four other components already defaulted to business.
    expect(effectiveMode({ preferredMode: undefined })).toBe('business');
    expect(effectiveMode({} as any)).toBe('business');
    expect(effectiveMode(null)).toBe('business');
    expect(effectiveMode(undefined)).toBe('business');
  });

  it('honours an explicit mode', () => {
    expect(effectiveMode({ preferredMode: 'business' })).toBe('business');
    expect(effectiveMode({ preferredMode: 'personal' })).toBe('personal');
  });

  it('matches the fallback the other components already use', () => {
    // If these ever disagree again the bug returns, and the disagreement is
    // invisible: one tab renders, the other refuses to open.
    const read = (f: string) => readFileSync(new URL(`../../client/src/${f}`, import.meta.url), 'utf8');
    for (const f of [
      'components/ModeToggle.tsx',
      'components/ModuleSwitcher.tsx',
      'components/AppShell.tsx',
    ]) {
      expect(read(f), `${f} should default to business`).toMatch(
        /preferredMode\s*(\?\?|\|\|)\s*'business'|preferredMode === 'personal' \? 'personal' : 'business'/,
      );
    }
  });
});

describe('safeInternalPath', () => {
  it('accepts an in-app path', () => {
    expect(safeInternalPath('/contact')).toBe('/contact');
    expect(safeInternalPath('/contact/jobs/12')).toBe('/contact/jobs/12');
  });

  it('rejects an absolute URL — the open-redirect case', () => {
    // A ?redirect=https://evil.example would otherwise turn our login page into a
    // convincing hop off-site, straight after a real sign-in.
    expect(safeInternalPath('https://evil.example')).toBeNull();
    expect(safeInternalPath('http://evil.example')).toBeNull();
  });

  it('rejects a protocol-relative URL', () => {
    // //evil.example resolves to another origin despite starting with a slash.
    expect(safeInternalPath('//evil.example')).toBeNull();
  });

  it('rejects a loop back to login', () => {
    // A redirect to /login is the loop we just removed, wearing a different hat.
    expect(safeInternalPath('/login')).toBeNull();
    expect(safeInternalPath('/login?redirect=/contact')).toBeNull();
  });

  it('rejects empty and nullish input', () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
    expect(safeInternalPath('')).toBeNull();
  });
});

describe('BusinessGuard source', () => {
  const app = readFileSync(new URL('../../client/src/App.tsx', import.meta.url), 'utf8');
  const code = app.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

  it('no longer compares preferredMode directly', () => {
    // A structural guard on the regression: if someone reintroduces the direct
    // comparison, the loop is back.
    expect(code).not.toMatch(/preferredMode\s*!==\s*'business'/);
    expect(code).not.toMatch(/preferredMode\s*!==\s*'personal'/);
  });

  it('redirects signed-out users to /login rather than the landing page', () => {
    // Bouncing a signed-out visitor to "/" showed them marketing content instead of
    // asking them to sign in.
    expect(code).toMatch(/!isAuthenticated[\s\S]{0,200}Navigate to="\/login"/);
  });

  it('preserves the intended destination in location state', () => {
    // Without this, signing in lands on a generic page and the customer has to find
    // the CRM a second time.
    expect(code).toMatch(/state=\{\{ from: window\.location\.pathname \}\}/);
  });
});

describe('post-login target', () => {
  const auth = readFileSync(new URL('../../client/src/pages/AuthPage.tsx', import.meta.url), 'utf8');

  it('honours state.from first', () => {
    // This is the "I clicked CRM and got bounced" case.
    expect(auth).toMatch(/location\.state[\s\S]{0,40}from/);
    const i = auth.indexOf('getPostLoginTarget');
    const body = auth.slice(i, i + 700);
    expect(body).toMatch(/safeInternalPath/);
    expect(body.indexOf('fromState')).toBeLessThan(body.indexOf('fromQuery'));
  });

  it('falls back to a per-mode home rather than one page for everyone', () => {
    const i = auth.indexOf('getPostLoginTarget');
    const body = auth.slice(i, i + 700);
    expect(body).toMatch(/effectiveMode\(user\) === 'business' \? '\/contact' : '\/me'/);
  });

  it('sends the personal fallback at a route that exists', () => {
    // A default of /me is only correct if /me is registered; sending anyone to a
    // 404 is a worse outcome than the generic page it replaced.
    const app = readFileSync(new URL('../../client/src/App.tsx', import.meta.url), 'utf8');
    expect(app).toMatch(/path="me"/);
  });
});