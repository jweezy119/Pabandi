import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Search, CreditCard, Settings } from 'lucide-react';

const TABS = [
  { id: 'home', label: 'Home', href: '/app', icon: Home, exact: true },
  { id: 'discover', label: 'Discover', href: '/app/discover', icon: Search, exact: false },
  { id: 'passport', label: 'Passport', href: '/app/passport', icon: CreditCard, exact: false },
  { id: 'settings', label: 'Settings', href: '/app/settings', icon: Settings, exact: false },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 backdrop-blur-xl border-t border-[var(--pab-border)] safe-area-bottom"
      style={{ backgroundColor: 'var(--bg-surface)', height: 'var(--pab-mobile-nav-height)', boxShadow: '0 -4px 20px rgba(180, 130, 90, 0.08)' }}
      aria-label="Consumer navigation"
    >
      <div className="flex justify-around items-center h-full px-3 max-w-md mx-auto">
        {TABS.map((tab) => {
          const isActive = tab.exact
            ? location.pathname === tab.href
            : location.pathname === tab.href || location.pathname.startsWith(tab.href + '/');
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              to={tab.href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-2xl touch-target transition-colors ${
                isActive ? 'text-[var(--terracotta)]' : 'text-[var(--soft-stone)] hover:text-[var(--terracotta)]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="consumer-tab-indicator"
                  className="absolute inset-x-2 inset-y-1 rounded-2xl bg-[var(--clay)]/14 pointer-events-none"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                className="relative z-10 flex flex-col items-center gap-0.5"
              >
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
                <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
