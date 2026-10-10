import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

/**
 * The regression these exist for.
 *
 * Reported as "the contactos page is not loading, it keeps looping and going back
 * to pabandi.com, and the console has no errors".
 *
 * ContactOSPage redirected to /contact/setup whenever the local business settings
 * had no vertical and no completion flag. `useBusinessSettings` was a plain,
 * unpersisted store, so those two values were always empty on a fresh load — the
 * redirect fired for every account, including ones that had already enrolled and
 * whose server answers 200. Because it was `replace`, the requested URL was
 * destroyed as well, so Back landed the person on whatever came before: usually
 * the marketing homepage at pabandi.com. Nothing threw, so nothing reached the
 * console.
 *
 * The fix makes the server the authority. `resolveCrmBusiness` is what every
 * /crm route consults, so a 200 from /crm/clients means the workspace renders and
 * no redirect of any kind may happen, whatever the local record says.
 */

/** Records the rendered path, so a redirect is observable. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

const AUTHED_USER = {
  id: 'u1',
  email: 't@example.com',
  firstName: 'Test',
  role: 'BUSINESS',
  preferredMode: 'business',
};

function mockFetch(status: number, body: unknown = { data: [] }) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Imported inside the test body so the store starts clean each time. */
async function renderContactOS(status: number) {
  mockFetch(status);
  const ContactOSPage = (await import('./ContactOSPage')).default;
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/contact']}>
        <LocationProbe />
        <Routes>
          <Route path="/contact" element={<ContactOSPage />} />
          <Route path="/contact/setup" element={<div>setup wizard</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(async () => {
  localStorage.clear();
  const { useAuthStore } = await import('../../store/authStore');
  useAuthStore.setState({
    isAuthenticated: true,
    token: 'test-token',
    user: AUTHED_USER,
  } as never);
  // The account has never seen the wizard — exactly the state an unpersisted
  // store produced for everyone.
  const { useBusinessSettings } = await import('../../hooks/useBusinessSettings');
  useBusinessSettings.setState({
    settings: {
      ...useBusinessSettings.getState().settings,
      vertical: null,
      hasCompletedSetup: false,
    },
  });
});

/**
 * Generous on purpose. The assertions are about where the page ends up, not about
 * how fast this machine is: vitest runs test files in parallel workers, and the
 * default 1000 ms failed two of these whenever the suite ran alongside anything
 * else heavy. A timeout that depends on load is a flaky test, not a strict one.
 */
const RENDER_TIMEOUT_MS = 10_000;

describe('ContactOSPage redirect', () => {
  it('renders the workspace when the server says the account is enrolled', async () => {
    // THE regression. This used to render "setup wizard".
    renderContactOS(200);

    await waitFor(() => expect(screen.getByText(/here's your business at a glance/i)).toBeTruthy(),
      { timeout: RENDER_TIMEOUT_MS });
    expect(screen.queryByText('setup wizard')).toBeNull();
    expect(screen.getByTestId('path').textContent).toBe('/contact');
  });

  it('sends an account with no service business to the setup wizard', async () => {
    // 403 from resolveCrmBusiness, and no local record of setup: only the wizard
    // can fix it, because it is the thing that asks for a vertical and a name.
    renderContactOS(403);

    await waitFor(() => expect(screen.getByText('setup wizard')).toBeTruthy(),
      { timeout: RENDER_TIMEOUT_MS });
    expect(screen.getByTestId('path').textContent).toBe('/contact/setup');
  });

  it('does not send an enrolled account to setup because of a server error', async () => {
    // A 500 says nothing about enrollment. Routing on it would push a working
    // account into the wizard whenever the API had a bad minute.
    renderContactOS(500);

    await waitFor(() => expect(screen.getByText(/here's your business at a glance/i)).toBeTruthy(),
      { timeout: RENDER_TIMEOUT_MS });
    expect(screen.queryByText('setup wizard')).toBeNull();
  });
});
