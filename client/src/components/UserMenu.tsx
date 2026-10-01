import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, toggleMode } = useAuthStore();
  const navigate = useNavigate();

  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const initials = displayName
    ? displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : (user?.email?.[0] ?? 'U').toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Mirrors ModeToggle's condition. These were written independently and
  // disagreed on the undefined case, so the two entry points could show
  // opposite labels for the same session.
  const handleToggleMode = async () => {
    const newMode = (user?.preferredMode ?? 'business') === 'business' ? 'personal' : 'business';
    setIsOpen(false);
    try {
      await toggleMode(newMode);
      navigate(newMode === 'business' ? '/contact' : '/me');
    } catch (err) {
      console.error('Failed to switch account mode:', err);
      // Stay where we are. Navigating on a failed switch would drop the user
      // into a route their guard is about to bounce them out of.
      alert('Could not switch account mode. Please try again.');
    }
  };

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { label: 'Profile', path: '/profile', icon: 'person' },
    { label: 'Wallet', path: '/wallet', icon: 'account_balance_wallet' },
    { label: 'Business Settings', path: '/business', icon: 'storefront' },
  ];

  const currentMode = user?.preferredMode || 'business';
  const modeLabel = currentMode === 'business' ? 'Switch to Personal' : 'Switch to Business';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-[rgba(255,255,255,0.6)] text-[var(--warm-ink)] hover:bg-white transition-colors shadow-sm border border-[rgba(191,179,163,0.3)]"
      >
        {initials}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[rgba(191,179,163,0.2)] overflow-hidden z-50"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <div className="p-4 border-b border-[rgba(191,179,163,0.2)] bg-[var(--atmosphere)]">
                <div className="font-bold text-[var(--warm-ink)] truncate">{user?.name || 'User'}</div>
                <div className="text-xs text-[var(--soft-stone)] truncate">{user?.email || ''}</div>
                <div className="mt-2">
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--clay)]/10 text-[var(--clay)]">
                    {currentMode === 'business' ? 'Business Mode' : 'Personal Mode'}
                  </span>
                </div>
              </div>
              <div className="py-2">
                {menuItems.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[var(--soft-stone)]">
                      {item.icon}
                    </span>
                    <span className="text-sm font-medium text-[var(--warm-ink)]">
                      {item.label}
                    </span>
                  </Link>
                ))}
                <button
                  onClick={handleToggleMode}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[rgba(0,0,0,0.03)] transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[18px] text-[var(--soft-stone)]">
                    swap_horiz
                  </span>
                  <span className="text-sm font-medium text-[var(--warm-ink)]">
                    {modeLabel}
                  </span>
                </button>
              </div>
              <div className="border-t border-[rgba(191,179,163,0.2)] py-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[rgba(201,123,90,0.05)] text-[var(--terracotta)] transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span className="text-sm font-medium">Log Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
