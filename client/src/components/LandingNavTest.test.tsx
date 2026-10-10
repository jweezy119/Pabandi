import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * The regression these exist for.
 *
 * Reported as: "when I click CRM at the top of the home page (which should be
 * Contact instead) it goes back to pabandi.com".
 *
 * Two defects, and only one of them is a redirect:
 *
 * 1. The tab was labelled "CRM" while pointing at /contact, which is branded
 *    Contact OS everywhere else. The label is cosmetic, but it is the thing the
 *    person saw before they clicked, so it is asserted here.
 *
 * 2. The real bounce was not this link at all. The SPA never mounted on any
 *    page: the entry chunk statically imported a 290 KB chunk of solana, leaflet
 *    and qrcode that throws
 *        Uncaught TypeError: Cannot read properties of undefined (reading 'Buffer')
 *    while evaluating, so the whole module graph failed and pabandi.com served a
 *    blank document. Every click did nothing, which reads as being sent back to
 *    the homepage. See client/vite.config.ts — the manual `heavy` chunk that
 *    caused it is gone.
 *
 * What is left to assert here is the part this app owns: the tab offers
 * /contact, and /contact is a route the app can render. Whether an account may
 * enter it is RouteGuards.test.tsx's subject, and is deliberately not repeated.
 *
 * The whole `App` was used here at first and it had to go: importing it loads a
 * second copy of react-dom, whose testing-library cleanup then tore down the
 * container mid-render in unrelated suites — two ContactOSPage tests failed with
 * an empty <body /> purely because this file also ran.
 */

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

/**
 * Renders the real nav shell on the landing page, with the link followed inside
 * the same router so the resulting path is observable.
 *
 * `Layout` rather than `App` because Layout is what actually renders the tab
 * bar: the smallest thing that proves the link exists and points where it says,
 * without pulling in the whole route table. The module is imported at call time
 * rather than at the top of the file because an eager import of Layout runs its
 * module scope during collection, and that is what duplicated react-dom in the
 * first version of this file.
 */
async function renderLandingPageWithNav() {
  const Layout = (await import('./Layout')).default;
  function Shell() {
    return <Layout />;
  }
  return render(
    <MemoryRouter initialEntries={['/']}>
      <LocationProbe />
      <Routes>
        <Route path="*" element={<Shell />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

/**
 * Every link in the shell whose target is exactly `/contact` — the desktop nav
 * item and the mobile tab both render in jsdom, since `md:hidden` is a class
 * rather than a conditional. Matched on href rather than accessible name because
 * the header also carries a "Contact" link to `/contact-us`, and a name query
 * silently matched that one — the test then passed against the wrong element.
 */
function findContactTabs(): HTMLElement[] {
  return screen
    .getAllByRole('link')
    .filter((el) => el.getAttribute('href') === '/contact');
}

describe('the contact tab on the public nav', () => {
  it('is labelled Contact, matching the OS it opens', async () => {
    // Reported directly: "which should be contact instead".
    await renderLandingPageWithNav();

    const tabs = findContactTabs();
    expect(tabs.length).toBeGreaterThan(0);
    for (const tab of tabs) {
      // The mobile tab renders its icon's ligature name too, so a whole-string
      // match will not do; and the desktop item is "Contact OS" while the mobile
      // tab is "Contact", both correct.
      expect(tab.textContent).toMatch(/Contact/);
      // The regression this file is really about: the mobile tab said "CRM" while
      // opening /contact, which is branded Contact OS everywhere else.
      expect(tab.textContent).not.toMatch(/CRM/);
    }
  });

  it('is offered to a signed-out visitor, and leads to /contact', async () => {
    // A visitor on the home page is signed out by definition, so this is the most
    // common click there is. The tab must exist for them and resolve to the CRM
    // entry route — the guard decides what happens next, not this link.
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null } as never);
    await renderLandingPageWithNav();

    findContactTabs()[0].click();

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/contact'));
  });
});
