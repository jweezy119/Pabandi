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
  // The guards moved out of App.tsx into components/RouteGuards.tsx so they can be
  // unit-tested — App.tsx imports every page in the app, so importing it into a test
  // pulls the whole application in. These structural assertions moved with them.
  //
  // Behaviour is now covered by client/src/components/RouteGuards.test.tsx. What is
  // kept here is the source-level regression net, which catches a reintroduced
  // anti-pattern even if it is written slightly differently than expected.
  const guards = readFileSync(
    new URL('../../client/src/components/RouteGuards.tsx', import.meta.url),
    'utf8',
  );
  const code = guards
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');

  const app = readFileSync(new URL('../../client/src/App.tsx', import.meta.url), 'utf8');

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

  it('does not silently bounce a personal-mode user to the marketing homepage', () => {
    // Reported as "clicking on contact os brings us back to pabandi.com".
    //
    // `<Navigate to="/" replace />` in the business branch did exactly that: the nav
    // offers Contact OS unconditionally, so the user clicked a link the app had
    // already decided to refuse, and `replace` destroyed the requested URL so Back
    // could not recover it. Nothing said why. PersonalGuard's own comment criticised
    // landing users on a marketing page while BusinessGuard was doing it.
    expect(code).not.toMatch(/<Navigate to="\/" replace \/>/);
  });

  it('shows the mode gate instead, so the click is not discarded', () => {
    expect(code).toMatch(/<BusinessModeGate \/>/);
  });

  it('does not send PersonalGuard to a route that is itself mode-guarded', () => {
    // PersonalGuard used to redirect to /contact, which is BusinessGuard-guarded, so a
    // business-mode user following a personal link was bounced back where they came
    // from — a loop that also lost the original request.
    expect(code).not.toMatch(/<Navigate to="\/contact" replace \/>/);
  });

  it('still guards the ContactOS routes in App.tsx', () => {
    // Guards being correct is worthless if the routes stopped using them.
    expect(app).toMatch(/path="contact" element=\{<BusinessGuard>/);
    expect(app).toMatch(/path="contact\/clients" element=\{<BusinessGuard>/);
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