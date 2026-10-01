/**
 * Absolute API base for the browser.
 *
 * WHY THIS EXISTS
 * 38 call sites across 18 files fetched a *relative* `/api/v1/...` URL. That
 * only resolves in local dev, where vite.config.ts proxies /api to
 * localhost:5000. In production the SPA is served by Firebase Hosting, whose
 * only rewrite is `** -> /index.html`, so `/api/v1/...` returns the SPA's HTML
 * with a 200. Every response.json() then throws and the caller shows an error
 * or an empty state.
 *
 * Firebase Hosting cannot proxy to pabandi.onrender.com — rewrites serve
 * static content from the same project — so an absolute URL is the only fix.
 * Most of the app already built one from VITE_API_URL inline; this centralises
 * it so the next person does not reach for a relative path by default.
 *
 * The `/api/v1` strip matters because .env.example documents
 * VITE_API_URL as `http://localhost:5000/api/v1` — with the suffix — while
 * .env.production has the bare host. Callers append the version themselves, so
 * a configured value that already carries it would produce /api/v1/api/v1.
 */
const RAW_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

export const API_HOST = RAW_BASE.replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '');

/**
 * Build an absolute API URL from a path that already includes the version,
 * e.g. apiUrl('/api/v1/crm/clients').
 */
export function apiUrl(path: string): string {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  return `${API_HOST}${withLeadingSlash}`;
}
