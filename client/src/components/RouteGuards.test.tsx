import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { BusinessGuard, PersonalGuard } from '../components/RouteGuards';
import { useAuthStore } from '../store/authStore';

/**
 * The regression these exist for.
 *
 * Reported as: "clicking on contact os brings us back to pabandi.com".
 *
 * BusinessGuard answered a personal-mode request for /contact with
 * `<Navigate to="/" replace />`. The nav offers "Contact OS" unconditionally, so the
 * user could click a link the app had already decided to refuse, and the only visible
 * result was the marketing homepage. Nothing in the 552 server tests could catch this:
 * the guard is client-side routing, and the defect is a disagreement between two
 * pieces of client code.
 */

const toggleMode = vi.fn();

/** Records the path currently rendered, so a redirect can be asserted on. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

/**
 * Renders `element` — the guard under test — at whatever path is requested, with every
 * redirect target registered as a real page so a redirect is observable.
 *
 * The guarded element is mounted at a splat route on purpose. An earlier version of
 * this helper registered fixed paths, which meant the PersonalGuard tests rendered a
 * static <div> and never exercised the guard at all: they passed while asserting
 * nothing about it. A test that cannot fail is worse than no test, because it looks
 * like coverage.
 */
function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<div>home page</div>} />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/dashboard" element={<div>dashboard page</div>} />
        <Route path="*" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

function setAuth(preferredMode: 'business' | 'personal' | undefined, isAuthenticated = true) {
  useAuthStore.setState({
    isAuthenticated,
    token: 'test-token',
    user: preferredMode === undefined ? { id: 'u1' } : { id: 'u1', preferredMode },
  } as never);
}

beforeEach(() => {
  toggleMode.mockReset();
  toggleMode.mockResolvedValue(undefined);
  useAuthStore.setState({ toggleMode } as never);
});

describe('BusinessGuard', () => {
  it('renders the business surface for a business-mode account', () => {
    setAuth('business');
    renderAt('/contact', <BusinessGuard><div>contact os</div></BusinessGuard>);
    expect(screen.getByText('contact os')).toBeTruthy();
  });

  it('shows the mode gate, not the home page, for a personal-mode account', () => {
    // THE regression. Previously this redirected to "/" and the assertion below would
    // have read "home page" instead.
    setAuth('personal');
    renderAt('/contact', <BusinessGuard><div>contact os</div></BusinessGuard>);

    expect(screen.queryByText('home page')).toBeNull();
    expect(screen.getByTestId('path').textContent).toBe('/contact');
    expect(screen.getByText(/part of your business account/i)).toBeTruthy();
  });

  it('treats a missing preferredMode as business, so the CRM is reachable', () => {
    // Sessions predating the server-side preferredMode fix have no value at all.
    // BusinessGuard alone used to treat that as a failure, which made every ContactOS
    // route unreachable for exactly those users.
    setAuth(undefined);
    renderAt('/contact', <BusinessGuard><div>contact os</div></BusinessGuard>);
    expect(screen.getByText('contact os')).toBeTruthy();
  });

  it('sends signed-out visitors to login with the intended destination', () => {
    setAuth('business', false);
    renderAt('/contact', <BusinessGuard><div>contact os</div></BusinessGuard>);
    expect(screen.getByTestId('path').textContent).toBe('/login');
  });

  it('offers a switch that resolves to business mode', async () => {
    setAuth('personal');
    renderAt('/contact', <BusinessGuard><div>contact os</div></BusinessGuard>);

    screen.getByRole('button', { name: /switch to business/i }).click();

    await waitFor(() => expect(toggleMode).toHaveBeenCalledWith('business'));
  });

  it('reports a failed switch instead of leaving a dead button', async () => {
    // The button disables itself while switching, so a silent failure would leave the
    // user looking at a control that stopped responding — the same class of dead
    // affordance as the Save button that started this.
    toggleMode.mockRejectedValue(new Error('network down'));
    setAuth('personal');
    renderAt('/contact', <BusinessGuard><div>contact os</div></BusinessGuard>);

    screen.getByRole('button', { name: /switch to business/i }).click();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not switch/i);
    expect(screen.getByRole('button', { name: /switch to business/i })).toBeTruthy();
  });
});

describe('PersonalGuard', () => {
  it('renders the personal surface for a personal-mode account', () => {
    setAuth('personal');
    renderAt('/me', <PersonalGuard><div>personal dashboard</div></PersonalGuard>);
    expect(screen.getByText('personal dashboard')).toBeTruthy();
  });

  it('does not bounce a business-mode user back to the page they came from', () => {
    // Was `<Navigate to="/contact" replace />`. /contact is BusinessGuard-guarded, so
    // a business-mode user following a personal link was returned to /contact, bounced
    // straight back here, and lost the original request.
    setAuth('business');
    renderAt('/me', <PersonalGuard><div>personal dashboard</div></PersonalGuard>);
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
  });
});
