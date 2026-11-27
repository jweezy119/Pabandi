import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CommandPalette } from './CommandPalette';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { PageTransition } from './PageTransition';
import { ThemeToggle } from './ThemeToggle';

const MotionLink = motion(Link);

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

/**
 * Where the sidebar brand sends you, per OS.
 *
 * It used to be a hard-coded `to="/"`, which is the marketing homepage. The
 * brand block is the loudest thing in the sidebar — the OS icon, the OS name
 * ("Contact OS") and "by Pabandi" — so it reads as the way back to that OS's
 * dashboard. Clicking it instead dropped a signed-in user onto the landing
 * page, which is the "clicking Contact OS bounces me back to pabandi.com"
 * report: from there the only route back into the CRM is a nav item that is
 * easy to miss, so the OS appears to have no way back.
 *
 * Each OS now points at its own root. Unknown names keep "/" — several of
 * these dashboards (Pabandi Pay, Protocol, Haq OS) have no OS root of their
 * own and the marketing page is the honest destination for them.
 */
const OS_ROOT: Record<string, string> = {
  'Contact OS': '/contact',
  'ContactOS': '/contact',
  'FreightOS': '/freight',
  'SafOS': '/freight',
  'PropertyOS': '/property',
  'BookingOS': '/booking',
  'CapitalOS': '/capital',
  'Trust OS': '/trust-os',
  'Project Simulator': '/simulator',
};

import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { getVerticalPersona } from '../config/verticalPersonas';

function buildNavFromSettings(settings: any, osName: string, defaultNav?: NavItem[]): NavItem[] {
  const persona = getVerticalPersona(settings?.vertical);
  const map: Record<string, any[]> = {
     'Contact OS': [
      { path: '/contact', label: 'Dashboard', icon: 'dashboard', feature: null, end: true },
      // Industry-personalized display labels powered by verticalPersonas.ts.
      // Underlying routes and canonical CRM states stay unified across all verticals.
      { path: '/contact/clients', label: persona.navLabels.clients, icon: 'verified_user', feature: 'clients' },
      { path: '/contact/deals', label: persona.navLabels.deals, icon: 'workspace_premium', feature: 'deals' },
      { path: '/contact/jobs', label: persona.navLabels.jobs, icon: 'work', feature: 'jobs' },
      { path: '/coordinator', label: 'Coordinator', icon: 'precision_manufacturing', feature: 'jobs' },
      { path: '/contact/activities', label: persona.navLabels.activities, icon: 'notifications', feature: 'activities' },
      { path: '/contact/tasks', label: persona.navLabels.tasks, icon: 'check', feature: 'tasks' },
      { path: '/outreach', label: 'Reach Customers', icon: 'campaign', feature: null },
      { path: '/contact/invoices', label: persona.navLabels.invoices, icon: 'lock', feature: 'invoices' },
      { path: '/contact/money-flow', label: 'Money Flow', icon: 'account_balance_wallet', feature: 'invoices' },
      { path: '/contact/trust-passport', label: 'Trust Passport', icon: 'shield_check', feature: null },
      { path: '/contact/team', label: persona.navLabels.team, icon: 'users', feature: 'team' },
      // NOTE: 'Companies' / B2B accounts used to sit here. It was removed
      // rather than pointed somewhere: there is no Company model, and CrmClient
      // has no company or account field, so there is no data behind the idea
      // and no page that could honestly render it. It is a product decision,
      // not a routing fix — reintroduce it with a model and a page together.
      // The Business OS workspace: the module grid that merges this CRM's data
      // with the other OSs, including PropertyOS. It is the only place the server
      // reports which modules are installed, so it is how a landlord reaches
      // their properties from inside the CRM rather than by typing a URL.
      { path: '/business-os', label: 'Workspace', icon: 'grid_view', feature: null },
      { path: '/contact/settings/modules', label: 'Settings', icon: 'settings', feature: null },
    ],
    'Trust OS': [
      { path: '/trust-os', label: 'Reliability Engine', icon: 'shield', feature: null, end: true },
      { path: '/trust-os/passport', label: 'ZK Trust Passport', icon: 'badge', feature: null },
      { path: '/trust-os/ledger', label: 'Escrow & Ledger', icon: 'account_balance', feature: null },
      { path: '/trust-os/verify', label: 'Counterparty Verifier', icon: 'verified', feature: null },
      { path: '/gigs', label: 'Escrow Gig Board', icon: 'handshake', feature: null },
    ],
  };

  if (map[osName]) {
    const enabled = Array.isArray(settings.enabledFeatures?.['contact'])
      ? settings.enabledFeatures['contact']
      : [];
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
  const [navItemsMounted, setNavItemsMounted] = useState(false);

  // ⌘K and the g-then-key navigation. Both lived in files that were written and
  // never mounted, so the CRM had no keyboard affordances at all despite having the
  // code for them.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useKeyboardShortcuts({ onOpenPalette: openPalette });

  const colorKey = colorKeys[osColor] || 'clay';
  const colors = colorMap[colorKey] || colorMap.clay;
  const osRoot = OS_ROOT[osName] || '/';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isActive = (item: NavItem) =>
    item.end
      ? location.pathname === item.path
      : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

  function toggleGroup(label: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Staggered entrance animation for nav items when they change
  useEffect(() => {
    if (!reducedMotion) {
      setNavItemsMounted(true);
    } else {
      setNavItemsMounted(true);
    }
  }, [navItems.length, osName, reducedMotion]);

  return (
    <div className="h-dashboard-shell flex overflow-hidden" style={{ background: 'var(--atmosphere)' }}>
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
        className={`fixed inset-y-0 left-0 lg:static z-50 w-64 h-full flex flex-col safe-area-top safe-area-bottom transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          background: 'var(--warm-sand)',
          boxShadow: 'var(--shadow-sidebar)',
        }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(191,179,163,0.2)' }}>
          <Link to={osRoot} className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center text-[var(--warm-ink)] font-bold text-lg`}
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
          <motion.div
            layout
            initial={false}
            animate={{ opacity: navItemsMounted ? 1 : 0, y: navItemsMounted ? 0 : 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, staggerChildren: 0.06 }}
            className="space-y-1"
          >
            {navItems
              .filter(item => !navGroups.some(g => g.items.some(i => i.path === item.path)))
              .map((item, index) => {
                const active = isActive(item);
                return (
                  <MotionLink
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
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      show: {
                        opacity: 1,
                        x: 0,
                        transition: {
                          type: 'spring',
                          stiffness: 380,
                          damping: 30,
                          delay: index * 0.06,
                        },
                      },
                    }}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
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
                  </MotionLink>
                );
              })}
          </motion.div>

          {/* Collapsible groups */}
          {navGroups.map(group => {
            const isExpanded = expandedGroups.has(group.label);
            return (
              <div key={group.label}>
                {/* Group header — chevron + label */}
                <motion.div
                  layout
                  initial={false}
                  animate={{ opacity: navItemsMounted ? 1 : 0, y: navItemsMounted ? 0 : 20 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30, staggerChildren: 0.06 }}
                  className="space-y-1"
                >
                  <motion.button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-left touch-target"
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label} section`}
                    whileTap={{ scale: 0.98 }}
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
                      <span className="text-[10px]" style={{ color: 'var(--soft-stone)' }}>
                        {group.items.length}
                      </span>
                    </div>
                  </motion.button>

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
                        <motion.div
                          layout
                          initial={false}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ staggerChildren: 0.04 }}
                          className="ml-6 space-y-1"
                        >
                          {group.items.map((item, index) => {
                            const active = isActive(item);
                            return (
                              <MotionLink
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
                                variants={{
                                  hidden: { opacity: 0, x: -20 },
                                  show: {
                                    opacity: 1,
                                    x: 0,
                                    transition: {
                                      type: 'spring',
                                      stiffness: 380,
                                      damping: 30,
                                      delay: index * 0.04,
                                    },
                                  },
                                }}
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.98 }}
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
                              </MotionLink>
                            );
                          })}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            );
          })}
        </nav>

        {/* Support & Theme card */}
        <div className="p-4 space-y-2.5" style={{ borderTop: '1px solid rgba(191,179,163,0.2)' }}>
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--soft-stone)', fontFamily: 'var(--font-label)' }}>
              Appearance
            </span>
            <ThemeToggle />
          </div>
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
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex-none sticky top-0 z-30 safe-area-top flex items-center justify-between px-4 py-3 bg-[var(--warm-sand)]/92 backdrop-blur-xl border-b border-[rgba(191,179,163,0.25)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg ${colors.icon} flex items-center justify-center text-[var(--warm-ink)] font-bold text-sm shrink-0`}>
              {osIcon}
            </div>
            <h1 className="text-base font-bold text-[var(--warm-ink)] truncate">{osName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setSidebarOpen(true)}
              className="p-2 -mr-2 text-[var(--soft-stone)] hover:bg-[rgba(232,217,197,0.5)] rounded-xl touch-target flex items-center justify-center"
              aria-label="Open sidebar"
            >
              <span className="material-symbols-outlined">menu</span>
            </motion.button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5 lg:p-8 pb-[var(--pab-mobile-nav-height)] lg:pb-8">
          <PageTransition>
            {children}
          </PageTransition>
        </div>

        {/* Mobile bottom tab bar */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 safe-area-bottom"
          style={{
            height: 'var(--pab-mobile-nav-height)',
            background: 'rgba(232, 217, 197, 0.94)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid rgba(191, 179, 163, 0.25)',
            boxShadow: '0 -4px 16px rgba(180, 130, 90, 0.08)',
          }}
        >
          <div className="flex h-full items-center overflow-x-auto no-scrollbar px-1">
            {navItems.slice(0, 5).map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative flex-1 flex flex-col items-center justify-center gap-0.5 px-1.5 py-2 min-w-[60px] touch-target transition-colors duration-200"
                  style={{
                    color: active ? 'var(--clay)' : 'var(--soft-stone)',
                    fontSize: '11px',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    className="flex flex-col items-center gap-0.5 max-w-full"
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <span className="truncate max-w-full">{item.label}</span>
                  </motion.div>
                  {active && (
                    <motion.span
                      layoutId="mobile-tab-indicator"
                      className="w-8 h-0.5 rounded-full mt-0.5"
                      style={{ background: 'var(--clay)' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </main>

      {/* Rendered once here so every CRM screen gets ⌘K without each page opting in.
          The palette returns null when closed. */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
