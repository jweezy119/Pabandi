import { useAuthStore } from '../store/authStore';
import { getAuthToken } from './authToken';

/**
 * The one canonical way to read the session token.
 *
 * Why this exists: the token lives in the Zustand store, persisted under the
 * `auth-storage` key. Nothing ever wrote it to `localStorage['token']`, yet 129
 * call sites read `getAuthToken()`. Every one of them got
 * `undefined`, so authenticated requests went out with no `Authorization`
 * header and came back 401. Use this instead of reading storage directly.
 *
 * Order matters:
 *   1. Live Zustand state — correct after login/logout in this tab.
 *   2. The persisted blob — correct on a fresh page load, before hydration
 *      completes. Zustand's `persist` middleware stores the whole state object
 *      under `auth-storage`, so the token sits at `.state.token`.
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  const live = useAuthStore.getState()?.token;
  if (live) return live;

  try {
    const raw = window.localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}