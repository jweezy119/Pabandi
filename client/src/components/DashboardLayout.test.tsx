import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';

/**
 * The regression these exist for.
 *
 * Reported as: signed in, clicking "Contact OS" in the in-app nav lands on the
 * pabandi.com marketing homepage — read as "there is no way to get to the CRM".
 *
 * The sidebar brand block (OS icon + OS name + "by Pabandi") is the loudest
 * affordance in every OS sidebar, and it read `to="/"`. For a signed-in user
 * inside the CRM, clicking the thing labelled "Contact OS" therefore navigated
 * to the landing page, which has no way back into the app except a nav item.
 *
 * Each OS now points at its own root, so the brand returns you to that OS's
 * dashboard rather than ejecting you to the marketing site.
 */

function renderSidebar(osName: string) {
  return render(
    <MemoryRouter>
      <DashboardLayout osName={osName} osIcon="C" osColor="clay">
        <div>page</div>
      </DashboardLayout>
    </MemoryRouter>,
  );
}

describe('DashboardLayout sidebar brand', () => {
  it('points the Contact OS brand at the CRM root, not the marketing page', () => {
    renderSidebar('Contact OS');
    const brand = screen.getByRole('link', { name: /contact os/i });
    expect(brand.getAttribute('href')).toBe('/contact');
  });

  it.each([
    ['FreightOS', '/freight'],
    ['PropertyOS', '/property'],
    ['BookingOS', '/booking'],
    ['CapitalOS', '/capital'],
  ])('points %s at %s', (osName, expected) => {
    renderSidebar(osName);
    const brand = screen.getByRole('link', { name: new RegExp(osName, 'i') });
    expect(brand.getAttribute('href')).toBe(expected);
  });

  it('keeps the marketing page for dashboards with no OS root of their own', () => {
    renderSidebar('Pabandi Pay');
    expect(screen.getByRole('link', { name: /pabandi pay/i }).getAttribute('href')).toBe('/');
  });
});
