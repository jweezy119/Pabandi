import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import { PageTransition } from './PageTransition';
import DashboardLayout from './DashboardLayout';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';

function NavControls() {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate('/contact')}>go-home</button>
      <button type="button" onClick={() => navigate('/contact/settings/modules')}>go-modules</button>
      <button type="button" onClick={() => navigate('/contact/settings/payment')}>go-payment</button>
    </div>
  );
}

function DummyPage({ label }: { label: string }) {
  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div data-testid="active-page">{label}</div>
    </DashboardLayout>
  );
}

describe('PageTransition & DashboardLayout navigation', () => {
  it('never stacks duplicate pages or sidebars across multiple route navigations', () => {
    render(
      <MemoryRouter initialEntries={['/contact']}>
        <NavControls />
        <Routes>
          <Route
            element={
              <PageTransition>
                <Outlet />
              </PageTransition>
            }
          >
            <Route path="/contact" element={<DummyPage label="Dashboard Home" />} />
            <Route path="/contact/settings/modules" element={<DummyPage label="Modules Settings" />} />
            <Route path="/contact/settings/payment" element={<DummyPage label="Get Paid Your Way" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByTestId('active-page')).toHaveLength(1);
    expect(screen.getAllByLabelText('Contact OS navigation')).toHaveLength(1);

    act(() => {
      screen.getByText('go-modules').click();
    });
    expect(screen.getAllByTestId('active-page')).toHaveLength(1);
    expect(screen.getByTestId('active-page').textContent).toBe('Modules Settings');
    expect(screen.getAllByLabelText('Contact OS navigation')).toHaveLength(1);

    act(() => {
      screen.getByText('go-payment').click();
    });
    expect(screen.getAllByTestId('active-page')).toHaveLength(1);
    expect(screen.getByTestId('active-page').textContent).toBe('Get Paid Your Way');
    expect(screen.getAllByLabelText('Contact OS navigation')).toHaveLength(1);
  });
});

function TelegramProbe() {
  const { isInsideTelegram } = useTelegramWebApp();
  return <div data-testid="tg-status">{isInsideTelegram ? 'inside' : 'outside'}</div>;
}

describe('useTelegramWebApp', () => {
  afterEach(() => {
    delete (window as any).Telegram;
  });

  it('does not invoke version-gated WebApp methods on desktop stub outside Telegram', () => {
    const ready = vi.fn();
    const expand = vi.fn();
    const setHeaderColor = vi.fn();
    const setBackgroundColor = vi.fn();
    const enableClosingConfirmation = vi.fn();

    (window as any).Telegram = {
      WebApp: {
        initData: '',
        platform: 'unknown',
        version: '6.0',
        isVersionAtLeast: () => false,
        ready,
        expand,
        setHeaderColor,
        setBackgroundColor,
        enableClosingConfirmation,
      },
    };

    render(<TelegramProbe />);
    expect(screen.getByTestId('tg-status').textContent).toBe('outside');
    expect(ready).not.toHaveBeenCalled();
    expect(expand).not.toHaveBeenCalled();
    expect(setHeaderColor).not.toHaveBeenCalled();
    expect(setBackgroundColor).not.toHaveBeenCalled();
    expect(enableClosingConfirmation).not.toHaveBeenCalled();
  });
});
