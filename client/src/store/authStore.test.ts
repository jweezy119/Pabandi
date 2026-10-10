import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The regression these exist for.
 *
 * Reported as: signed in, clicking ContactOS lands on the Sign In page — and
 * from there the only way out is the marketing homepage. Repeatedly, with no
 * apparent cause.
 *
 * The cause was the session lifetime. The access token is short-lived
 * (`JWT_EXPIRES_IN`, 15m in this repo's server/.env), and the client's boot
 * sweep answered an expired access token with `logout()` — destroying a
 * session the server would have happily reissued from its 30-day refresh
 * token. The server issues that refresh token on every login; the client
 * threw it away, and the 401 interceptor was deliberately a no-op. So after
 * the token aged out, the next page load signed the user out and every
 * guarded route (all of ContactOS) bounced them to /login.
 *
 * These pin the behaviour that replaces it: an expired access token is
 * refreshed, and only a refresh the server actually refuses ends the session.
 */

vi.mock('../services/api', () => ({
  authService: { refreshToken: vi.fn() },
  crmService: {},
  cryptoService: {},
}));

const { useAuthStore } = await import('./authStore');
const { authService } = await import('../services/api');

const refreshMock = vi.mocked(authService.refreshToken);

const loggedIn = () => ({
  user: { id: 'u1', email: 't@example.com', role: 'BUSINESS_OWNER', preferredMode: 'business' as const },
  token: 'stale-access-token',
  refreshToken: 'good-refresh-token',
  isAuthenticated: true,
});

beforeEach(() => {
  localStorage.clear();
  refreshMock.mockReset();
});

describe('authStore.refreshSession', () => {
  it('trades the refresh token for a new access token and keeps the session', async () => {
    refreshMock.mockResolvedValue({ data: { data: { token: 'fresh-access-token' } } } as never);
    useAuthStore.setState(loggedIn());

    const ok = await useAuthStore.getState().refreshSession();

    expect(ok).toBe(true);
    expect(refreshMock).toHaveBeenCalledWith('good-refresh-token');
    const state = useAuthStore.getState();
    expect(state.token).toBe('fresh-access-token');
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe('u1');
  });

  it('keeps the refresh token when the server does not send a new one', async () => {
    refreshMock.mockResolvedValue({ data: { data: { token: undefined } } } as never);
    useAuthStore.setState(loggedIn());

    const ok = await useAuthStore.getState().refreshSession();

    expect(ok).toBe(false);
    expect(useAuthStore.getState().refreshToken).toBe('good-refresh-token');
  });

  it('does NOT sign the user out when the refresh call fails', async () => {
    // A refused refresh or a dead network is not a statement that the account
    // is signed out. Wiping the session here is the reported bug: the user gets
    // ejected from ContactOS to the login page on their next click. The
    // decision to end the session belongs to the route guard, not the network.
    refreshMock.mockRejectedValue(new Error('network'));
    useAuthStore.setState(loggedIn());

    const ok = await useAuthStore.getState().refreshSession();

    expect(ok).toBe(false);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe('u1');
    expect(state.token).toBe('stale-access-token');
  });

  it('does nothing when there is no refresh token to trade', async () => {
    useAuthStore.setState({ ...loggedIn(), refreshToken: null });

    const ok = await useAuthStore.getState().refreshSession();

    expect(ok).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe('authStore session bookkeeping', () => {
  it('stores the refresh token returned by login', () => {
    useAuthStore.setState({
      ...loggedIn(),
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    useAuthStore.setState({ token: 'a', refreshToken: 'b' });

    expect(useAuthStore.getState().refreshToken).toBe('b');
  });

  it('logout clears the refresh token along with the session', () => {
    useAuthStore.setState(loggedIn());
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
  });
});
