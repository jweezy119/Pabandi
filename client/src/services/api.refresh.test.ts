import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * The 401 path, end to end.
 *
 * The access token is short-lived, so a 401 is a routine event, not a
 * statement that the account is signed out. Before this, the response
 * interceptor was a no-op with a comment saying so — every 401 fell through
 * to whichever page made the call, and the app-level consequence of an expired
 * token was a bounce to the login page.
 *
 * This drives a real HTTP server: the first call is refused with a 401, the
 * refresh endpoint issues a new token, and the original request is replayed.
 * What is asserted is that the caller never sees the 401 and that the replayed
 * request carries the new token.
 */

const { apiClient } = await import('./api');
const { useAuthStore } = await import('../store/authStore');

let server: http.Server;
let baseUrl: string;
const authHeaders: string[] = [];
let refreshCalls = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    // jsdom runs XHR under CORS, and the test document's origin is not this
    // server — so the preflight has to be answered or every call fails with a
    // network error that says nothing about the code under test.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const auth = String(req.headers.authorization || '');
    if (req.url?.includes('/auth/refresh')) {
      refreshCalls += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { token: 'FRESH-ACCESS-TOKEN' } }));
      return;
    }
    authHeaders.push(auth);
    // First attempt with the stale token is refused; anything after is fine.
    if (auth === 'Bearer stale-token') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'jwt expired' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { ok: true } }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  apiClient.defaults.baseURL = baseUrl;

  useAuthStore.setState({
    token: 'stale-token',
    refreshToken: 'good-refresh-token',
    isAuthenticated: true,
    user: { id: 'u1', email: 't@example.com', role: 'BUSINESS_OWNER' },
  });
});

afterAll(() => {
  server.close();
});

describe('apiClient 401 handling', () => {
  it('refreshes the access token and replays the request', async () => {
    const response = await apiClient.get('/protected/thing');

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ success: true, data: { ok: true } });
    expect(refreshCalls).toBe(1);
    // The replayed request went out with the token the refresh returned, not
    // the stale one that was refused.
    expect(authHeaders).toContain('Bearer FRESH-ACCESS-TOKEN');
    expect(useAuthStore.getState().token).toBe('FRESH-ACCESS-TOKEN');
  });

  it('surfaces a 401 when there is no refresh token to trade', async () => {
    // First test left the store holding the refreshed token, so put it back
    // into the state under test: a stale access token and nothing to trade.
    const before = refreshCalls;
    useAuthStore.setState({ token: 'stale-token', refreshToken: null });
    await expect(apiClient.get('/protected/thing')).rejects.toBeTruthy();
    // No refresh token to trade, so no refresh request is made — a 401 with
    // nothing to refresh surfaces to the caller rather than looping.
    expect(refreshCalls).toBe(before);
  });
});
