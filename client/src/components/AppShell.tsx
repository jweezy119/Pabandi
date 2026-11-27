import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModuleSwitcher } from './ModuleSwitcher';
import { UserMenu } from './UserMenu';
import { SupportWidget } from './SupportWidget';
import { ModeToggle } from './ModeToggle';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '../store/authStore';
import { WalletModal } from './WalletModal';
import { useWalletModal } from '../hooks/useWalletModal';
import { ModeTransitionOverlay } from './ModeTransitionOverlay';
import { PageTransition } from './PageTransition';

// Business users manage the whole operation from their phone: the two-item bar
// used to hide the workspace and the day's jobs behind a desktop-only switcher.
const BUSINESS_MOBILE_MODULES = [
  { id: 'contact', label: 'Contact', path: '/contact', icon: 'contacts', color: 'var(--clay)', end: false },
  { id: 'jobs', label: 'Jobs', path: '/contact/jobs', icon: 'work', color: 'var(--muted-ochre)', end: false },
  { id: 'workspace', label: 'Workspace', path: '/business-os', icon: 'grid_view', color: 'var(--sage)', end: false },
  { id: 'booking', label: 'Book', path: '/booking', icon: 'book_online', color: 'var(--sage)', end: false },
];

const PERSONAL_MOBILE_MODULES = [
  { id: 'me', label: 'My Hub', path: '/me', icon: 'person', color: 'var(--sage)', end: true },
  { id: 'passport', label: 'Passport', path: '/me/passport', icon: 'verified_user', color: 'var(--clay)', end: false },
  { id: 'bookings', label: 'Bookings', path: '/me/bookings', icon: 'event', color: 'var(--sage)', end: false },
  { id: 'rewards', label: 'Rewards', path: '/me/rewards', icon: 'toll', color: 'var(--muted-ochre)', end: false },
  { id: 'booking', label: 'Discover', path: '/booking', icon: 'explore', color: 'var(--clay)', end: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, wallet } = useAuthStore();
  const { openModal } = useWalletModal();
  const activeMode = (user?.preferredMode || 'business').toUpperCase();
  const isBusiness = activeMode === 'BUSINESS';
  const visibleModules = isBusiness ? BUSINESS_MOBILE_MODULES : PERSONAL_MOBILE_MODULES;

  // OS pages that bring their own DashboardLayout mobile navigation or drawer
  // (BookingOS, ContactOS, PropertyOS, FreightOS, CapitalOS, TrustOS) manage their
  // own bottom tab bar. Stacking AppShell's bottom nav on top creates a double-bar collision.
  const isDashboardLayoutPage = /^\/(booking|contact|property|freight|capital|trust-os|coordinator|simulator|ledger|cod|dashboard\/trust-passport)(\/|$)/.test(location.pathname);

  return (
    <div className="flex flex-col h-dvh-shell bg-[var(--bg-main)] overflow-hidden" data-mode={user?.preferredMode || 'business'}>
      {/* Top Navigation Bar */}
      <header className="flex-none min-h-[4rem] safe-area-top px-3 sm:px-4 lg:px-6 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)]/90 backdrop-blur-xl z-50">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link to={isBusiness ? "/dashboard" : "/me"} className="flex items-center gap-2 touch-target">
            {isBusiness ? (
              <>
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-[var(--warm-ink)] font-bold text-sm shadow-sm shrink-0">
                  P
                </div>
                <span className="hidden sm:inline font-bold text-[var(--text-main)] font-headline truncate">PabandiOS</span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[var(--warm-ink)] font-bold text-sm shadow-sm shrink-0">
                  {user?.firstName?.[0] || user?.name?.[0] || 'U'}
                </div>
                <span className="hidden sm:inline font-bold text-[var(--text-main)] font-headline truncate">{user?.firstName || user?.name || 'Personal'}</span>
              </>
            )}
          </Link>
        </div>

        <div className="flex items-center justify-center flex-1 mx-1 sm:mx-4">
          <ModuleSwitcher />
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button onClick={openModal} className="flex flex-col items-end mr-1 sm:mr-2 hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer text-left compact-touch">
            <span className="text-[10px] font-bold uppercase tracking-widest leading-tight" style={{ color: 'var(--soft-stone)' }}>Universal Balance</span>
            <span className="font-bold text-xs sm:text-sm leading-tight" style={{ color: isBusiness ? 'var(--clay)' : 'var(--sage)' }}>{wallet.pabBalance} PAB</span>
          </button>
          <ModeToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 min-h-0 relative ${
          isDashboardLayoutPage
            ? 'overflow-hidden flex flex-col'
            : 'overflow-y-auto overscroll-y-contain mobile-safe-bottom md:pb-0'
        }`}
        style={
          isDashboardLayoutPage
            ? ({ '--pab-dashboard-height': '100%' } as React.CSSProperties)
            : undefined
        }
      >
        {isDashboardLayoutPage ? (
          children
        ) : (
          <PageTransition>
            {children}
          </PageTransition>
        )}
        <SupportWidget />
      </main>

      {/* Mobile Bottom Navigation (only on shell/hub pages; OS dashboards have their own navigation) */}
      {!isDashboardLayoutPage && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 bg-[#FAF6F0]/92 backdrop-blur-xl border-t border-[rgba(191,179,163,0.35)] flex items-center justify-around z-50 safe-area-bottom"
          style={{ height: 'var(--pab-mobile-nav-height)', boxShadow: '0 -4px 20px rgba(180, 130, 90, 0.08)' }}
          aria-label="Mobile navigation"
        >
          {visibleModules.map(module => {
            const isActive = module.end
              ? location.pathname === module.path
              : location.pathname === module.path || location.pathname.startsWith(module.path + '/');
            return (
              <Link
                key={module.id}
                to={module.path}
                className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 min-w-[56px] max-w-[84px] touch-target"
                style={{ color: isActive ? module.color : 'var(--soft-stone)' }}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId="appshell-mobile-tab-indicator"
                    className="absolute inset-x-2 top-1 bottom-1 rounded-2xl pointer-events-none"
                    style={{ backgroundColor: 'rgba(201, 123, 90, 0.12)' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className="relative z-10 flex flex-col items-center gap-0.5"
                >
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {module.icon}
                  </span>
                  <span className={`text-[10px] tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>{module.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Global Overlays */}
      <WalletModal />
      <ModeTransitionOverlay />
    </div>
  );
}
