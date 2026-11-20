import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import { LanguageProvider } from '../context/LanguageContext';
import { useAuthStore } from '../store/authStore';
import { apiClient, authService } from '../services/api';
import { statsService } from '../services/statsService';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{`${location.pathname}${location.search}`}</div>;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
  } as never);
});

describe('Home Page Top Navigation (LandingPage)', () => {
  it('removes Sharia and Financial Inclusion tabs, adds For Customers, and renders icons next to every top tab', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: {} } } as any);

    const LandingPage = (await import('./LandingPage')).default;
    render(
      <HelmetProvider>
        <LanguageProvider>
          <MemoryRouter initialEntries={['/']}>
            <LandingPage />
          </MemoryRouter>
        </LanguageProvider>
      </HelmetProvider>
    );

    const mainNav = screen.getByRole('navigation', { name: 'Main' });
    const navLinks = within(mainNav).getAllByRole('link');

    const hrefs = navLinks.map((a) => a.getAttribute('href'));
    const labels = navLinks.map((a) => a.textContent?.trim());

    expect(hrefs).not.toContain('/sharia-compliance');
    expect(hrefs).not.toContain('/impact');
    expect(labels).not.toContain('Sharia');
    expect(labels).not.toContain('Financial Inclusion');

    expect(hrefs).toEqual(['/contact', '/customers', '/agents', '/pricing']);
    expect(labels).toEqual(['For Businesses', 'For Customers', 'For AI Developers', 'Pricing']);

    // Every top nav tab should carry an icon
    for (const link of navLinks) {
      expect(link.querySelector('svg')).not.toBeNull();
    }
  });
});

describe('CustomersPage (/customers)', () => {
  it('updates live Profile Readiness Meter and completes frictionless 2-step signup straight to /me?welcome=1', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        items: [
          {
            id: 'biz-1',
            name: 'Lahore Brew House',
            category: 'RESTAURANT',
            city: 'Lahore',
            rating: 4.9,
            reviewCount: 42,
            startingPrice: 25,
            escrowEnabled: true,
          },
        ],
      },
    } as any);

    const requestCodeSpy = vi
      .spyOn(authService, 'requestVerificationCode')
      .mockResolvedValue({ data: { success: true } } as any);

    const verifyCodeSpy = vi
      .spyOn(authService, 'verifyLoginCode')
      .mockResolvedValue({
        data: {
          success: true,
          data: {
            user: {
              id: 'user-1',
              email: 'amina@pabandi.io',
              firstName: 'User',
              lastName: '',
              role: 'CUSTOMER',
              preferredMode: 'personal',
              profileType: null,
            },
            token: 'initial-jwt',
            refreshToken: 'refresh-jwt',
          },
        },
      } as any);

    const onboardSpy = vi
      .spyOn(authService, 'completeOnboarding')
      .mockResolvedValue({
        data: {
          success: true,
          data: {
            user: {
              id: 'user-1',
              email: 'amina@pabandi.io',
              firstName: 'Amina',
              lastName: 'Khan',
              phone: '+13125550199',
              location: 'Chicago',
              role: 'CUSTOMER',
              preferredMode: 'personal',
              profileType: 'CLIENT',
            },
            token: 'reissued-personal-jwt',
          },
        },
      } as any);

    const CustomersPage = (await import('./CustomersPage')).default;
    render(
      <HelmetProvider>
        <LanguageProvider>
          <MemoryRouter initialEntries={['/customers']}>
            <LocationProbe />
            <Routes>
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/me" element={<div data-testid="personal-hub-page">Personal Hub</div>} />
            </Routes>
          </MemoryRouter>
        </LanguageProvider>
      </HelmetProvider>
    );

    // Endowed progress starts at 20%
    expect(screen.getByTestId('profile-readiness-pct').textContent).toBe('20% Ready');

    // Fill Step 1 details (including optional phone + city bonus)
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Amina' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Khan' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'amina@pabandi.io' } });
    expect(screen.getByTestId('profile-readiness-pct').textContent).toBe('75% Ready');

    fireEvent.click(screen.getByRole('button', { name: /Add phone & city/i }));
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '+13125550199' } });
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Chicago' } });
    expect(screen.getByTestId('profile-readiness-pct').textContent).toBe('100% Ready');

    // Submit Step 1
    fireEvent.click(screen.getByRole('button', { name: /Create Personal Profile & Send Code/i }));
    await waitFor(() => expect(requestCodeSpy).toHaveBeenCalledWith('amina@pabandi.io'));

    // Enter Step 2 code
    const codeInput = await screen.findByLabelText(/6-Digit Verification Code/i);
    fireEvent.change(codeInput, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify & Open My Personal Hub/i }));

    await waitFor(() => {
      expect(verifyCodeSpy).toHaveBeenCalledWith('amina@pabandi.io', '654321');
      expect(onboardSpy).toHaveBeenCalledWith({
        profileType: 'CLIENT',
        firstName: 'Amina',
        lastName: 'Khan',
        phone: '+13125550199',
        location: 'Chicago',
      });
      expect(screen.getByTestId('current-location').textContent).toBe('/me?welcome=1');
    });

    expect(useAuthStore.getState().token).toBe('reissued-personal-jwt');
    expect(useAuthStore.getState().user?.firstName).toBe('Amina');
    expect(useAuthStore.getState().user?.preferredMode).toBe('personal');
  });

  it('offers quick Personal Hub actions for signed-in personal customers', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, items: [] } } as any);
    useAuthStore.setState({
      isAuthenticated: true,
      token: 'tok',
      user: {
        id: 'u-2',
        email: 'sara@pabandi.io',
        firstName: 'Sara',
        lastName: 'Ali',
        role: 'CUSTOMER',
        profileType: 'CLIENT',
        preferredMode: 'personal',
      },
    } as never);

    const CustomersPage = (await import('./CustomersPage')).default;
    render(
      <HelmetProvider>
        <LanguageProvider>
          <MemoryRouter initialEntries={['/customers']}>
            <CustomersPage />
          </MemoryRouter>
        </LanguageProvider>
      </HelmetProvider>
    );

    expect(screen.getByText(/Welcome back, Sara!/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open Personal Hub/i }).getAttribute('href')).toBe('/me');
    expect(screen.getByRole('link', { name: /Browse Businesses/i }).getAttribute('href')).toBe('/booking');
    expect(screen.getByRole('link', { name: /My Bookings/i }).getAttribute('href')).toBe('/me/bookings');
  });

  it('offers one-click Switch to Personal Hub for business-mode accounts', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, items: [] } } as any);
    const toggleSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      isAuthenticated: true,
      token: 'tok',
      user: {
        id: 'u-3',
        email: 'owner@pabandi.io',
        firstName: 'Bilal',
        lastName: 'Raza',
        role: 'BUSINESS_OWNER',
        profileType: 'SERVICE_BUSINESS',
        preferredMode: 'business',
      },
      toggleMode: toggleSpy,
    } as never);

    const CustomersPage = (await import('./CustomersPage')).default;
    render(
      <HelmetProvider>
        <LanguageProvider>
          <MemoryRouter initialEntries={['/customers']}>
            <LocationProbe />
            <Routes>
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/me" element={<div>Personal Hub</div>} />
            </Routes>
          </MemoryRouter>
        </LanguageProvider>
      </HelmetProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Switch to Personal Hub & Book Businesses/i }));

    await waitFor(() => {
      expect(toggleSpy).toHaveBeenCalledWith('personal');
      expect(screen.getByTestId('current-location').textContent).toBe('/me');
    });
  });
});

describe('PersonalDashboardPage (/me) Welcome & Quick-Start Quest', () => {
  it('shows the celebratory welcome banner on ?welcome=1 and renders the endowed-progress Quick-Start Quest', async () => {
    vi.spyOn(statsService, 'me').mockResolvedValue({
      trustScore: { score: null, tier: null, reliability: null },
      yieldEarned: null,
      activeEscrows: { count: 0, totalUsd: 0, items: [] },
    } as any);

    useAuthStore.setState({
      isAuthenticated: true,
      token: 'tok',
      user: {
        id: 'u-4',
        email: 'amina@pabandi.io',
        firstName: 'Amina',
        lastName: 'Khan',
        role: 'CUSTOMER',
        profileType: 'CLIENT',
        preferredMode: 'personal',
      },
    } as never);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const PersonalDashboardPage = (await import('./me/PersonalDashboardPage')).default;

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/me?welcome=1']}>
          <LocationProbe />
          <PersonalDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const banner = await screen.findByTestId('welcome-banner');
    expect(banner.textContent).toContain('Welcome to Pabandi, Amina!');

    const quest = screen.getByTestId('customer-quickstart-quest');
    expect(quest.textContent).toContain('Quick-Start Progress');
    expect(quest.textContent).toContain('1 of 4 milestones complete');
    expect(quest.textContent).toContain('Personal Profile Created');

    // Dismissing the welcome banner clears ?welcome=1 cleanly
    fireEvent.click(screen.getByRole('button', { name: /Dismiss welcome banner/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('welcome-banner')).toBeNull();
      expect(screen.getByTestId('current-location').textContent).toBe('/me');
    });
  });
});
