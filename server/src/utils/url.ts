/**
 * URL helpers shared by the OAuth redirect logic.
 */

/** `https://Host:port/path?q` → `https://host:port`, or null if it is not an http(s) URL. */
export function normalizeOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(String(raw));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * A relative path we are willing to bounce someone to after login.
 *
 * Absolute URLs and protocol-relative `//evil.com` are refused: the return path
 * comes from the client, and it has to stay inside the app.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw) return '/';
  const value = String(raw);
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://pabandi.com');
    return `${url.pathname}${url.search}` || '/';
  } catch {
    return '/';
  }
}
