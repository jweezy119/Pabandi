import { describe, it, expect } from 'vitest';

/**
 * The regression these exist for.
 *
 * Reported as: "the same loop is still happening, this time I tried logging in
 * from GitHub".
 *
 * Signing in with GitHub ends at `/auth/callback` on the origin this process
 * decides — which was `process.env.CLIENT_URL`. On this deployment CLIENT_URL is
 * the API origin, and Render serves the built SPA from it, so the login looked
 * like it worked: the session was written into *that* origin's localStorage.
 * pabandi.com is a different origin, so the user was signed out the instant
 * they went back to the site they started from, and clicking "Sign in with
 * GitHub" began the same trip. Loop.
 *
 * The origin now comes from the client via the OAuth state, checked against an
 * allowlist: honouring a URL straight from the request would make this endpoint
 * an open redirect for phishing links.
 */

const { resolveFrontendOrigin } = await import('../../src/utils/oauthRedirect');

// The deployment's own configuration, reproduced per test: CLIENT_URL points at
// the API origin there, which is the whole bug.
const API_ORIGIN_CONFIGURED = 'https://pabandi.onrender.com';

describe('resolveFrontendOrigin', () => {
  it('returns the SPA origin the client asked for', () => {
    expect(resolveFrontendOrigin('https://pabandi.com', API_ORIGIN_CONFIGURED)).toBe('https://pabandi.com');
    expect(resolveFrontendOrigin('https://www.pabandi.com', API_ORIGIN_CONFIGURED)).toBe('https://www.pabandi.com');
    expect(resolveFrontendOrigin('https://pabandi-42c5b.web.app', API_ORIGIN_CONFIGURED)).toBe(
      'https://pabandi-42c5b.web.app',
    );
  });

  it('does not fall back to the API origin the deployment is configured with', () => {
    // This is the reported loop: a missing/opaque state used to produce the API
    // origin, whose localStorage is not the one the user is browsing with.
    expect(resolveFrontendOrigin(null, API_ORIGIN_CONFIGURED)).toBe('https://pabandi.com');
    expect(resolveFrontendOrigin(undefined, API_ORIGIN_CONFIGURED)).toBe('https://pabandi.com');
    expect(resolveFrontendOrigin('not-a-url', API_ORIGIN_CONFIGURED)).toBe('https://pabandi.com');
  });

  it('refuses an origin that is not a known SPA', () => {
    const attacker = 'https://pabandi.com.evil.example';
    expect(resolveFrontendOrigin(attacker, API_ORIGIN_CONFIGURED)).toBe('https://pabandi.com');
    expect(resolveFrontendOrigin('https://evil.example', API_ORIGIN_CONFIGURED)).toBe('https://pabandi.com');
    expect(resolveFrontendOrigin('javascript:alert(1)', API_ORIGIN_CONFIGURED)).toBe('https://pabandi.com');
    expect(resolveFrontendOrigin('//evil.example', API_ORIGIN_CONFIGURED)).toBe('https://pabandi.com');
  });

  it('normalises a configured origin so paths and ports cannot be smuggled in', () => {
    expect(resolveFrontendOrigin('https://pabandi.com/app?x=1', API_ORIGIN_CONFIGURED)).toBe('https://pabandi.com');
    expect(resolveFrontendOrigin('http://localhost:3000', API_ORIGIN_CONFIGURED)).toBe('http://localhost:3000');
  });

  it('honours an explicitly configured SPA origin', () => {
    expect(resolveFrontendOrigin(null, 'https://pabandi-42c5b.web.app')).toBe('https://pabandi.com');
    expect(resolveFrontendOrigin('https://pabandi-42c5b.web.app', 'https://pabandi-42c5b.web.app')).toBe(
      'https://pabandi-42c5b.web.app',
    );
  });
});
