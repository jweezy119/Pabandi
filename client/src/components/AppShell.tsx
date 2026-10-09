import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ModuleSwitcher } from './ModuleSwitcher';
import { UserMenu } from './UserMenu';
import { SupportWidget } from './SupportWidget';
import { ModeToggle } from './ModeToggle';
import { useAuthStore } from '../store/authStore';
import { WalletModal } from './WalletModal';
import { useWalletModal } from '../hooks/useWalletModal';

const MOBILE_MODULES = [
  { id: 'contact', label: 'Contact', path: '/contact', icon: 'contacts', color: 'var(--clay)' },
  { id: 'booking', label: 'Book', path: '/booking', icon: 'book_online', color: 'var(--sage)' },
  { id: 'property', label: 'Property', path: '/property', icon: 'real_estate_agent', color: 'var(--sky-wash)' },
  { id: 'freight', label: 'Freight', path: '/freight', icon: 'local_shipping', color: 'var(--muted-ochre)' },
  { id: 'capital', label: 'Capital', path: '/capital', icon: 'account_balance', color: 'var(--dusty-rose)' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, wallet } = useAuthStore();
  const { openModal } = useWalletModal();
  const activeMode = (user?.preferredMode || 'business').toUpperCase();
  const isBusiness = activeMode === 'BUSINESS';
  const visibleModules = MOBILE_MODULES.filter(m => {
    if (m.id === 'property' || m.id === 'freight' || m.id === 'capital') {
      return activeMode === 'BUSINESS';
    }
    return true;
  });

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-main)] overflow-hidden" data-mode={user?.preferredMode || 'business'}>
      {/* Top Navigation Bar */}
      <header className="flex-none h-16 px-4 lg:px-6 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)]/90 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <Link to={isBusiness ? "/dashboard" : "/me"} className="flex items-center gap-2">
            {isBusiness ? (
              <>
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  P
                </div>
                <span className="hidden sm:inline font-bold text-[var(--text-main)] font-headline">PabandiOS</span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {user?.firstName?.[0] || user?.name?.[0] || 'U'}
                </div>
                <span className="hidden sm:inline font-bold text-[var(--text-main)] font-headline">{user?.firstName || user?.name || 'Personal'}</span>
              </>
            )}
          </Link>
        </div>

        <div className="hidden md:flex items-center justify-center flex-1 mx-4">
          <ModuleSwitcher />
        </div>

        <div className="flex items-center gap-4">
          <button onClick={openModal} className="flex flex-col items-end mr-2 hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--soft-stone)' }}>Universal Balance</span>
            <span className="font-bold text-sm" style={{ color: isBusiness ? 'var(--clay)' : 'var(--sage)' }}>{wallet.pabBalance} PAB</span>
          </button>
          <ModeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {children}
        <SupportWidget />
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden flex-none h-16 bg-white border-t border-[rgba(191,179,163,0.2)] flex items-center justify-around z-50 safe-area-bottom">
        {visibleModules.map(module => {
          const isActive = location.pathname.startsWith(module.path);
          return (
            <Link
              key={module.id}
              to={module.path}
              className="flex flex-col items-center gap-0.5 py-1 px-2 min-w-[64px]"
              style={{ color: isActive ? module.color : 'var(--soft-stone)' }}
            >
              <span className="material-symbols-outlined text-[22px]">{module.icon}</span>
              <span className="text-[10px] font-medium">{module.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Global Overlays */}
      <WalletModal />
    </div>
  );
}
