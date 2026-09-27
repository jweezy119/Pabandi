import React from 'react';
import { Link } from 'react-router-dom';
import { ModuleSwitcher } from './ModuleSwitcher';
import { UserMenu } from './UserMenu';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-[var(--atmosphere)] overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="flex-none h-16 px-4 lg:px-6 flex items-center justify-between border-b border-[rgba(191,179,163,0.2)] bg-[rgba(245,239,230,0.92)] backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--clay)] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              P
            </div>
            <span className="hidden sm:inline font-bold text-[var(--warm-ink)] font-headline">PabandiOS</span>
          </Link>
        </div>

        <div className="flex items-center justify-center flex-1 mx-4">
          <ModuleSwitcher />
        </div>

        <div className="flex items-center gap-3">
          <UserMenu />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
