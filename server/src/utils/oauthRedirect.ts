import { normalizeOrigin } from './url';

/**
 * Which SPA origin an OAuth flow returns the user to.
 *
 * The bug these exist for: the OAuth callback redirected to
 * `process.env.CLIENT_URL`, and on this deployment CLIENT_URL is the API origin
 * (https://pabandi.onrender.com — Render serves the built SPA from it too). The
 * API also serves the app, so the login "worked": the session was written into
 * localStorage on pabandi.onrender.com, the user was happily signed in there,
 * and the moment they went back to pabandi.com they were signed out again,
 * because localStorage is per-origin. Click "Sign in with GitHub" → land on the
 * wrong origin → return to the real site → signed out → click again. That loop
 * is what was reported.
 *
 * The client tells us which origin it started from in the OAuth state, so the
 * answer no longer depends on CLIENT_URL being configured to the SPA. It is
 * still checked against an allowlist: honouring an arbitrary URL from the state
 * would turn this endpoint into an open redirect for a phishing link.
 */

export const DEFAULT_FRONTEND_ORIGIN = 'https://pabandi.com';

const KNOWN_FRONTEND_ORIGINS = [
  'https://pabandi.com',
  'https://www.pabandi.com',
  'https://pabandi-42c5b.web.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

/** Origins the server may send a just-authenticated user back to. */
export function allowedFrontendOrigins(configured?: string | null): string[] {
  const allowed: string[] = [...KNOWN_FRONTEND_ORIGINS];
  for (const candidate of [
    configured,
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
  ]) {
    const normalized = normalizeOrigin(candidate);
    if (normalized && !allowed.includes(normalized)) allowed.push(normalized);
  }
  return allowed;
}

/**
 * Resolve the origin to redirect to, preferring the one the client asked for.
 * Falls back to the first allowed origin — the real SPA, not the API — so a
 * missing or bogus state still lands the user somewhere that is signed in.
 */
export function resolveFrontendOrigin(
  requested: string | null | undefined,
  configured?: string | null,
): string {
  const allowed = allowedFrontendOrigins(configured);
  const normalized = normalizeOrigin(requested);
  if (normalized && allowed.includes(normalized)) return normalized;
  return allowed[0] ?? DEFAULT_FRONTEND_ORIGIN;
}
