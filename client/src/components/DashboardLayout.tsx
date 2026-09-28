import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface DashboardLayoutProps {
  osName: string;
  osIcon: string;
  osColor: string;
  navItems?: NavItem[];
  navGroups?: NavGroup[];
  children: React.ReactNode;
}

const colorMap: Record<string, { icon: string; active: string; activeBg: string; text: string; indicator: string }> = {
  terracotta: {
    icon: 'bg-[var(--clay)]',
    active: 'text-[var(--warm-ink)] font-bold',
    activeBg: 'rgba(201, 123, 90, 0.12)',
    text: 'text-[var(--soft-stone)]',
    indicator: 'var(--clay)',
  },
  clay: {
    icon: 'bg-[var(--clay)]',
    active: 'text-[var(--warm-ink)] font-bold',
    activeBg: 'rgba(201, 123, 90, 0.12)',
    text: 'text-[var(--soft-stone)]',
    indicator: 'var(--clay)',
  },
  sage: {
    icon: 'bg-[var(--sage)]',
    active: 'text-[var(--warm-ink)] font-bold',
    activeBg: 'rgba(138, 154, 123, 0.12)',
    text: 'text-[var(--soft-stone)]',
    indicator: 'var(--sage)',
  },
  'dusty-rose': {
    icon: 'bg-[var(--dusty-rose)]',
    active: 'text-[var(--warm-ink)] font-bold',
    activeBg: 'rgba(212, 165, 165, 0.12)',
    text: 'text-[var(--soft-stone)]',
    indicator: 'var(--dusty-rose)',
  },
  ochre: {
    icon: 'bg-[var(--muted-ochre)]',
    active: 'text-[var(--warm-ink)] font-bold',
    activeBg: 'rgba(217, 168, 84, 0.12)',
    text: 'text-[var(--soft-stone)]',
    indicator: 'var(--muted-ochre)',
  },
  'sky-wash': {
    icon: 'bg-[var(--sky-wash)]',
    active: 'text-[var(--warm-ink)] font-bold',
    activeBg: 'rgba(184, 201, 212, 0.12)',
    text: 'text-[var(--soft-stone)]',
    indicator: 'var(--sky-wash)',
  },
};

const OS_DESCRIPTIONS: Record<string, string> = {
  'FreightOS': 'Freight & logistics platform',
  'PropertyOS': 'Property management platform',
  'BookingOS': 'Booking & discovery platform',
  'Contact OS': 'CRM & sales pipeline',
  'LedgerOS': 'Finance & accounting',
};

const colorKeys: Record<string, string> = {
  emerald: 'terracotta',
  amber: 'ochre',
  violet: 'dusty-rose',
  indigo: 'sky-wash',
  rose: 'dusty-rose',
  terracotta: 'terracotta',
  clay: 'clay',
  sage: 'sage',
  'dusty-rose': 'dusty-rose',
  ochre: 'ochre',
  'sky-wash': 'sky-wash',
};

import { useBusinessSettings } from '../hooks/useBusinessSettings';

function buildNavFromSettings(settings: any, osName: string, defaultNav?: NavItem[]): NavItem[] {
  const map: Record<string, any[]> = {
    'Contact OS': [
      { path: '/contact', label: 'Dashboard', icon: 'dashboard', feature: null, end: true },
      { path: '/contact/clients', label: 'Clients', icon: 'groups', feature: 'clients' },
      { path: '/contact/companies', label: 'Companies', icon: 'building', feature: 'companies' },
      { path: '/contact/deals', label: 'Deals', icon: 'handshake', feature: 'deals' },
      { path: '/contact/jobs', label: 'Jobs', icon: 'work', feature: 'jobs' },
      { path: '/contact/activities', label: 'Activities', icon: 'notifications', feature: 'activities' },
      { path: '/contact/tasks', label: 'Tasks', icon: 'check', feature: 'tasks' },
      { path: '/contact/invoices', label: 'Invoices', icon: 'file', feature: 'invoices' },
      { path: '/contact/team', label: 'Team', icon: 'users', feature: 'team' },
      { path: '/contact/settings/modules', label: 'Settings', icon: 'settings', feature: null },
    ],
  };

  if (map[osName]) {
    const enabled = settings.enabledFeatures['contact'] ?? [];
    return map[osName].filter(item => 
      item.feature === null || enabled.includes(item.feature)
    );
  }
  return defaultNav || [];
}

export default function DashboardLayout({
  osName,
  osIcon,
  osColor,
  navItems: defaultNavItems,
  navGroups = [],
  children,
}: DashboardLayoutProps) {
  const { settings } = useBusinessSettings();
  const navItems = buildNavFromSettings(settings, osName, defaultNavItems);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const colorKey = colorKeys[osColor] || 'clay';
  const colors = colorMap[colorKey] || colorMap.clay;

  const isActive = (item: NavItem) =>
    item.end
      ? location.pathname === item.path
      : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

  const description = OS_DESCRIPTIONS[osName] || '';

  function toggleGroup(label: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className="h-full flex" style={{ background: 'var(--atmosphere)' }}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ backgroundColor: 'rgba(42, 37, 32, 0.25)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar — lifted off content with warm shadow ────────── */}
      <aside
        className={`absolute lg:static z-50 w-64 h-full flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          background: 'var(--warm-sand)',
          boxShadow: 'var(--shadow-sidebar)',
        }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(191,179,163,0.2)' }}>
          <Link to="/" className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center text-white font-bold text-lg`}
              style={{ boxShadow: '0 2px 8px rgba(180, 130, 90, 0.20)' }}
            >
              {osIcon}
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--warm-ink)', fontFamily: 'var(--font-headline)' }}>
                {osName}
              </h1>
              <p style={{ color: 'var(--soft-stone)', fontSize: '11px', fontFamily: 'var(--font-label)' }}>
                by Pabandi
              </p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg transition-colors duration-150"
            style={{ color: 'var(--soft-stone)' }}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* ─── Navigation with collapsible groups ─────────────────────── */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label={`${osName} navigation`}>
          {/* Standalone items (not in a group) */}
          {navItems
            .filter(item => !navGroups.some(g => g.items.some(i => i.path === item.path)))
            .map(item => {
              const active = isActive(item);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                    active ? colors.active : `${colors.text} hover:text-[var(--warm-ink)]`
                  }`}
                  style={{
                    backgroundColor: active ? colors.activeBg : 'transparent',
                    transition: 'background-color 200ms ease, color 150ms ease',
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute left-0 w-1 h-5 rounded-r-full"
                      style={{ backgroundColor: colors.indicator }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}

          {/* Collapsible groups */}
          {navGroups.map(group => {
            const isExpanded = expandedGroups.has(group.label);
            return (
              <div key={group.label}>
                {/* Group header — chevron + label */}
                <div
                  className="flex items-center justify-between px-4 py-2 rounded-2xl"
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleGroup(group.label)}
                  role="button"
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label} section`}
                >
                  <div className="flex items-center gap-2">
                    <motion.span
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.25, ease: [0.25, 0.9, 0.35, 1] }}
                      className="material-symbols-outlined text-[16px] flex-shrink-0"
                      style={{ color: 'var(--soft-stone)' }}
                    >
                      chevron_right
                    </motion.span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warm-ink)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {group.label}
                    </span>
                    <span className="text-[10px" style={{ color: 'var(--soft-stone)' }}>
                      {group.items.length}
                    </span>
                  </div>
                </div>

                {/* Group content — slides open/closed */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key={group.label}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.25, 0.9, 0.35, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      {group.items.map(item => {
                        const active = isActive(item);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ml-6 ${
                              active ? colors.active : `${colors.text} hover:text-[var(--warm-ink)]`
                            }`}
                            style={{
                              backgroundColor: active ? colors.activeBg : 'transparent',
                              transition: 'background-color 200ms ease, color 150ms ease',
                            }}
                            aria-current={active ? 'page' : undefined}
                          >
                            {active && (
                              <motion.div
                                layoutId="nav-indicator"
                                className="absolute left-0 w-1 h-5 rounded-r-full"
                                style={{ backgroundColor: colors.indicator }}
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                              />
                            )}
                            <span className="material-symbols-outlined text-[18px] flex-shrink-0" aria-hidden="true">
                              {item.icon}
                            </span>
                            {item.label}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Support card */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(191,179,163,0.2)' }}>
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'rgba(255, 255, 255, 0.5)',
              boxShadow: '0 1px 4px rgba(180, 130, 90, 0.06)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--soft-stone)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Need help?
            </div>
            <div className="mt-1" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warm-ink)' }}>
              Contact Support
            </div>
            <div className="mt-0.5" style={{ fontSize: '12px', color: 'var(--clay)' }}>
              jay@pabandi.com
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}


        {/* Page content */}
        <motion.div
          key={location.pathname}
          className="flex-1 overflow-auto p-5 lg:p-8"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1.0, 0.36, 1] }}
        >
          {children}
        </motion.div>

        {/* Mobile bottom tab bar */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 safe-area-bottom"
          style={{
            background: 'rgba(232, 217, 197, 0.95)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid rgba(191, 179, 163, 0.2)',
            boxShadow: '0 -4px 16px rgba(180, 130, 90, 0.06)',
          }}
        >
          <div className="flex overflow-x-auto no-scrollbar">
            {navItems.slice(0, 5).map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 min-w-[64px] transition-colors duration-200"
                  style={{
                    color: active ? 'var(--clay)' : 'var(--soft-stone)',
                    fontSize: '11px',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="truncate max-w-full">{item.label}</span>
                  {active && (
                    <motion.span
                      layoutId="mobile-tab-indicator"
                      className="w-8 h-0.5 rounded-full mt-0.5"
                      style={{ background: 'var(--clay)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}
