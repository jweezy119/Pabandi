import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  end?: boolean;
}

export interface DashboardLayoutProps {
  osName: string;
  osIcon: string;
  osColor: string;
  navItems: NavItem[];
  children: React.ReactNode;
}

const colorMap: Record<string, { gradientFrom: string; gradientTo: string; iconBg: string; activeBg: string; activeText: string; activeBorder: string }> = {
  emerald: {
    gradientFrom: 'from-emerald-400',
    gradientTo: 'to-cyan-500',
    iconBg: 'bg-gradient-to-br from-emerald-400 to-cyan-500',
    activeBg: 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/10',
    activeText: 'text-emerald-300',
    activeBorder: 'border-emerald-500/20',
  },
  amber: {
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-orange-600',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    activeBg: 'bg-gradient-to-r from-amber-500/20 to-orange-500/10',
    activeText: 'text-amber-300',
    activeBorder: 'border-amber-500/20',
  },
  violet: {
    gradientFrom: 'from-violet-500',
    gradientTo: 'to-indigo-600',
    iconBg: 'bg-gradient-to-br from-violet-500 to-indigo-600',
    activeBg: 'bg-gradient-to-r from-violet-500/20 to-indigo-500/10',
    activeText: 'text-violet-300',
    activeBorder: 'border-violet-500/20',
  },
  indigo: {
    gradientFrom: 'from-indigo-500',
    gradientTo: 'to-blue-600',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-blue-600',
    activeBg: 'bg-gradient-to-r from-indigo-500/20 to-blue-500/10',
    activeText: 'text-indigo-300',
    activeBorder: 'border-indigo-500/20',
  },
  rose: {
    gradientFrom: 'from-rose-500',
    gradientTo: 'to-pink-600',
    iconBg: 'bg-gradient-to-br from-rose-500 to-pink-600',
    activeBg: 'bg-gradient-to-r from-rose-500/20 to-pink-500/10',
    activeText: 'text-rose-300',
    activeBorder: 'border-rose-500/20',
  },
};

const OS_DESCRIPTIONS: Record<string, string> = {
  'FreightOS': 'Freight & logistics platform. Post loads, find carriers, track shipments.',
  'PropertyOS': 'Property management platform. Manage tenants, leases, and revenue.',
  'BookingOS': 'Booking & discovery platform. Find restaurants, hotels, and services.',
  'PipelineOS': 'CRM & sales pipeline. Track leads, deals, and activities.',
  'LedgerOS': 'Finance & accounting. Invoices, expenses, cash flow, and reports.',
};

export default function DashboardLayout({ osName, osIcon, osColor, navItems, children }: DashboardLayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const colors = colorMap[osColor] || colorMap.emerald;

  const isActive = (item: NavItem) =>
    item.end
      ? location.pathname === item.path
      : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

  const description = OS_DESCRIPTIONS[osName] || '';

  return (
    <div className="min-h-screen flex bg-[#020617]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static z-50 w-64 h-screen bg-[#0a0f1a] border-r border-white/5 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <Link to="/" className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center text-white font-bold text-lg`}>
              {osIcon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{osName}</h1>
              <p className="text-xs text-slate-400">by Pabandi</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-slate-400" aria-label="Close sidebar">✕</button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label={`${osName} navigation`}>
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? `${colors.activeBg} ${colors.activeText} border ${colors.activeBorder}` : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                aria-current={active ? 'page' : undefined}>
                <span className="material-symbols-outlined text-[18px] flex-shrink-0" aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="rounded-xl bg-white/5 border border-white/5 p-4">
            <div className="text-xs text-slate-400 mb-1">Need help?</div>
            <div className="text-sm text-white font-medium">Contact Support</div>
            <div className="text-xs text-emerald-400 mt-1">support@pabandi.com</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar - mobile */}
        <header className="sticky top-0 z-30 bg-[#0a0f1a]/80 backdrop-blur-sm border-b border-white/5 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-white/5 text-slate-300" aria-label="Open menu">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center text-white font-bold text-sm`}>{osIcon}</div>
              <span className="font-bold text-white">{osName}</span>
            </div>
            <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-bold" aria-label="User menu">U</button>
          </div>
        </header>

        {/* Top bar - desktop (balance, tier, notifications) */}
        <header className="hidden lg:flex sticky top-0 z-30 bg-[#0a0f1a]/80 backdrop-blur-sm border-b border-white/5 px-6 py-3 items-center justify-between">
          <div className="text-slate-400 text-sm">
            <Link to="/" className="hover:text-white transition">Pabandi</Link>
            <span className="mx-2">›</span>
            <span className="text-white">{osName}</span>
            {description && <span className="ml-2 text-slate-500">— {description}</span>}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">account_balance_wallet</span>
              <span className="text-sm text-white font-medium">$0.00</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
              <span className="material-symbols-outlined text-amber-400 text-[18px]">stars</span>
              <span className="text-sm text-white font-medium">Bronze Tier</span>
            </div>
            <button className="p-2 rounded-lg hover:bg-white/5 text-slate-400 relative" aria-label="Notifications">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a0f1a] border-t border-white/5 safe-area-bottom">
          <div className="flex overflow-x-auto no-scrollbar">
            {navItems.slice(0, 5).map((item) => {
              const active = isActive(item);
              return (
                <Link key={item.path} to={item.path}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-medium min-w-[64px] ${active ? colors.activeText : 'text-slate-400 active:text-white'}`}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{item.icon}</span>
                  <span className="truncate max-w-full">{item.label}</span>
                  {active && <span className={`w-8 h-0.5 ${colors.iconBg} rounded-full mt-0.5`} />}
                </Link>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}
