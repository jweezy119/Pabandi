/**
 * The account mode, and how to read it.
 *
 * WHY THIS EXISTS IN ITS OWN FILE
 * -------------------------------
 * `preferredMode` is optional on the user type and is missing for anyone whose
 * stored session predates the server-side fix that added it to the login payload.
 * Nothing re-fetches the user on boot — there is no /me endpoint — so that absence
 * is permanent for those sessions, not a transient loading state.
 *
 * Four components already fell back to 'business' when it was absent (ModeToggle,
 * ModuleSwitcher, AppShell, UserMenu). BusinessGuard alone treated it as a failure,
 * so the CRM was unreachable for exactly those users: every ContactOS route bounced
 * to "/" with `replace`, destroying the intended URL, and pressing Back returned to
 * the landing page again.
 *
 * So the fallback lives here, once, with the reasoning attached — rather than being
 * restated at each call site where it can drift a fifth time.
 */

export type AccountMode = 'business' | 'personal';

/** Business unless explicitly personal. Mirrors registration's default. */
export function effectiveMode(
  user: { preferredMode?: AccountMode } | null | undefined,
): AccountMode {
  return user?.preferredMode === 'personal' ? 'personal' : 'business';
}

/**
 * Accept a redirect target only if it is a path within this app.
 *
 * An attacker-supplied `?redirect=https://evil.example` or `state.from` would
 * otherwise turn the login page into a convincing hop off-site — the victim signs
 * in on our domain and is handed to a lookalike. Two shapes are rejected: absolute
 * URLs (no leading slash) and protocol-relative ones (`//host`, which resolve to
 * another origin).
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  // Never bounce back to the login page itself: a redirect loop that looks like the
  // bug it replaced is worse than no redirect.
  if (raw.includes('/login')) return null;
  return raw;
}
