import { useAuthStore } from '../store/authStore';

/**
 * Canonical auth token accessor.
 *
 * ## Why this exists
 *
 * Forty components and pages were reading the token with
 * `localStorage.getItem('token')`. Nothing in the client has *ever* written that
 * key. The session lives in the zustand `authStore`, persisted under
 * `auth-storage` as `{ state: { token, user, ... } }`. So every one of those call
 * sites was sending `Authorization: Bearer null`, receiving a 401, and — because
 * the failures were swallowed with `.catch(() => ({ data: {} }))` — rendering
 * an empty page with no error. That is the "pages aren't loading" symptom.
 *
 * Resolution order, most authoritative first:
 *
 *   1. The live in-memory store. Correct even before persistence rehydrates and
 *      immune to the persisted JSON shape changing.
 *   2. The persisted store, as a fallback for a hard reload where rehydration may
 *      not have completed when a module-level caller reads.
 *
 * Never add `localStorage.setItem('token', …)` to fix a caller. A second source
 * of truth is what created the bug in the first place.
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const live = useAuthStore.getState().token;
    if (live) return live;
  } catch {
    // Store not yet initialised (circular import during module init, or SSR).
  }

  // Fallback: read the persisted snapshot directly.
  try {
    const raw = window.localStorage.getItem('auth-storage');
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const token =
      parsed?.state?.token ??
      parsed?.token ??
      null;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/** True when a usable token exists. For guarding renders, not for auth checks. */
export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}

/**
 * `Authorization` header for a raw `fetch`.
 *
 * Prefer the shared `apiClient` from `services/api.ts`, which attaches the token
 * automatically. This exists for the many call sites that hand-roll `fetch` and
 * only need the header fixed.
 */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
