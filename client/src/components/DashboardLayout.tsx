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

const colorMap: Record<string, { icon: string; active: string; text: string; border: string; indicator: string }> = {
  terracotta: {
    icon: 'bg-[var(--clay)]',
    active: 'bg-[var(--clay)] text-white',
    text: 'text-[var(--soft-stone)]',
    border: 'border-[var(--soft-stone)]',
    indicator: 'bg-[var(--clay)]',
  },
  sage: {
    icon: 'bg-[var(--sage)]',
    active: 'bg-[var(--sage)] text-white',
    text: 'text-[var(--soft-stone)]',
    border: 'border-[var(--soft-stone)]',
    indicator: 'bg-[var(--sage)]',
  },
  'dusty-rose': {
    icon: 'bg-[var(--dusty-rose)]',
    active: 'bg-[var(--dusty-rose)] text-white',
    text: 'text-[var(--soft-stone)]',
    border: 'border-[var(--soft-stone)]',
    indicator: 'bg-[var(--dusty-rose)]',
  },
  ochre: {
    icon: 'bg-[var(--muted-ochre)]',
    active: 'bg-[var(--muted-ochre)] text-white',
    text: 'text-[var(--soft-stone)]',
    border: 'border-[var(--soft-stone)]',
    indicator: 'bg-[var(--muted-ochre)]',
  },
  'sky-wash': {
    icon: 'bg-[var(--sky-wash)]',
    active: 'bg-[var(--sky-wash)] text-white',
    text: 'text-[var(--soft-stone)]',
    border: 'border-[var(--soft-stone)]',
    indicator: 'bg-[var(--sky-wash)]',
  },
};

const OS_DESCRIPTIONS: Record<string, string> = {
  'FreightOS': 'Freight & logistics platform',
  'PropertyOS': 'Property management platform',
  'BookingOS': 'Booking & discovery platform',
  'PipelineOS': 'CRM & sales pipeline',
  'LedgerOS': 'Finance & accounting',
};

const colorKeys: Record<string, string> = {
  emerald: 'terracotta',
  amber: 'ochre',
  violet: 'dusty-rose',
  indigo: 'sky-wash',
  rose: 'dusty-rose',
  terracotta: 'terracotta',
  sage: 'sage',
  'dusty-rose': 'dusty-rose',
  ochre: 'ochre',
  'sky-wash': 'sky-wash',
};

export default function DashboardLayout({ osName, osIcon, osColor, navItems, children }: DashboardLayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const colorKey = colorKeys[osColor] || 'terracotta';
  const colors = colorMap[colorKey] || colorMap.terracotta;

  const isActive = (item: NavItem) =>
    item.end
      ? location.pathname === item.path
      : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

  const description = OS_DESCRIPTIONS[osName] || '';

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--cream)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static z-50 w-64 h-screen flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'var(--warm-sand)', borderRight: '1px solid rgba(191,179,163,0.3)' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(191,179,163,0.3)' }}>
          <Link to="/" className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center text-white font-bold text-lg`}>
              {osIcon}
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--warm-ink)' }}>{osName}</h1>
              <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>by Pabandi</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-[var(--soft-stone)]/20" style={{ color: 'var(--soft-stone)' }} aria-label="Close sidebar">✕</button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label={`${osName} navigation`}>
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? colors.active : `${colors.text} hover:bg-[var(--soft-stone)]/20`}`}
                aria-current={active ? 'page' : undefined}>
                <span className="material-symbols-outlined text-[18px] flex-shrink-0" aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4" style={{ borderTop: '1px solid rgba(191,179,163,0.3)' }}>
          <div className="rounded-xl p-4" style={{ background: 'rgba(191,179,163,0.15)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--soft-stone)' }}>Need help?</div>
            <div className="text-sm font-medium" style={{ color: 'var(--warm-ink)' }}>Contact Support</div>
            <div className="text-xs mt-1" style={{ color: 'var(--clay)' }}>support@pabandi.com</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 lg:hidden px-4 py-3 flex items-center justify-between"
          style={{ background: 'rgba(245,239,230,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(191,179,163,0.3)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg" style={{ color: 'var(--soft-stone)' }} aria-label="Open menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${colors.icon} flex items-center justify-center text-white font-bold text-sm`}>{osIcon}</div>
            <span className="font-bold" style={{ color: 'var(--warm-ink)' }}>{osName}</span>
          </div>
          <button className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--warm-sand)', color: 'var(--warm-ink)' }} aria-label="User menu">U</button>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex sticky top-0 z-30 px-6 py-3 items-center justify-between"
          style={{ background: 'rgba(245,239,230,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(191,179,163,0.3)' }}>
          <div className="text-sm" style={{ color: 'var(--soft-stone)' }}>
            <Link to="/" className="hover:text-[var(--clay)] transition">Pabandi</Link>
            <span className="mx-2">›</span>
            <span style={{ color: 'var(--warm-ink)' }}>{osName}</span>
            {description && <span className="ml-2" style={{ color: 'var(--soft-stone)' }}>— {description}</span>}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--warm-sand)' }}>
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--soft-stone)' }}>account_balance_wallet</span>
              <span className="text-sm font-medium" style={{ color: 'var(--warm-ink)' }}>$0.00</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--warm-sand)' }}>
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--muted-ochre)' }}>stars</span>
              <span className="text-sm font-medium" style={{ color: 'var(--warm-ink)' }}>Bronze Tier</span>
            </div>
            <button className="p-2 rounded-lg hover:bg-[var(--warm-sand)] relative" style={{ color: 'var(--soft-stone)' }} aria-label="Notifications">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: 'var(--terracotta)' }}></span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 safe-area-bottom"
          style={{ background: 'var(--warm-sand)', borderTop: '1px solid rgba(191,179,163,0.3)' }}>
          <div className="flex overflow-x-auto no-scrollbar">
            {navItems.slice(0, 5).map((item) => {
              const active = isActive(item);
              return (
                <Link key={item.path} to={item.path}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-medium min-w-[64px] ${active ? 'text-[var(--clay)]' : 'text-[var(--soft-stone)]'}`}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{item.icon}</span>
                  <span className="truncate max-w-full">{item.label}</span>
                  {active && <span className={`w-8 h-0.5 rounded-full mt-0.5`} style={{ background: 'var(--clay)' }} />}
                </Link>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}
