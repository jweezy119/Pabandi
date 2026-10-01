import { useAuthStore } from '../store/authStore';

/**
 * The active businessId, and the reason it lives in two places.
 *
 * WHY THIS EXISTS
 * ContactOS pages resolve their tenant two different ways, and both predate
 * this module:
 *
 *  - ~20 pages read `localStorage.getItem('businessId')` directly.
 *  - ~6 pages read it off the auth store.
 *
 * Nothing in the repository ever WROTE the localStorage copy. Every one of
 * those pages therefore resolved businessId to `''`, hit a `if (businessId)`
 * load guard that never fired, and rendered permanently empty — activities,
 * tasks, team, all six report widgets, and six settings pages. So the key is
 * written here, once, from the single source the login response now provides.
 *
 * The duplicate storage is ugly, and consolidating ~26 call sites onto the
 * store is the right end state, but doing that in one pass alongside a
 * production outage risks breaking a page I cannot test. Keeping both in sync
 * is the smaller, reversible step. TODO: migrate the pages, then delete the
 * localStorage mirror.
 *
 * If no business is attached to the account (a personal-only user), this
 * returns null and the caller must handle it — a business module with no
 * tenant is not a valid state to fetch against.
 */
export function getActiveBusinessId(): string | null {
  // Prefer the live store; fall back to the persisted blob for the window
  // before Zustand rehydration completes on a hard refresh.
  const live = useAuthStore.getState()?.user;
  const fromStore = live?.businessId ?? live?.business?.id ?? null;
  if (fromStore) return fromStore;

  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('businessId');
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Mirror the active businessId into localStorage for the pages that read it
 * directly. Call this after login, register, and any business switch.
 *
 * A null businessId clears the key rather than writing "null", because
 * `if (businessId)` is truthy for the string "null" and would unblock a load
 * that then 500s.
 */
export function syncBusinessId(businessId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (businessId) {
      window.localStorage.setItem('businessId', businessId);
    } else {
      window.localStorage.removeItem('businessId');
    }
  } catch {
    // Private browsing / quota. The store copy still works for the pages that
    // read it from there, so this is not worth surfacing to the user.
  }
}

/** Query string for a CRM call, or '' when there is no business to scope to. */
export function businessIdParam(): string {
  const id = getActiveBusinessId();
  return id ? `businessId=${encodeURIComponent(id)}` : '';
}

/** Full CRM query string with an optional extra param merged in. */
export function withBusinessId(extra: Record<string, string | number | undefined | null> = {}): string {
  const params = new URLSearchParams();
  const id = getActiveBusinessId();
  if (id) params.set('businessId', id);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
