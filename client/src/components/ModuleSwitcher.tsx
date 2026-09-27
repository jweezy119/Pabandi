import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const modules = [
  { id: 'contact', label: 'ContactOS', path: '/contact', icon: 'contacts', color: 'var(--clay)' },
  { id: 'booking', label: 'BookingOS', path: '/property', icon: 'book_online', color: 'var(--sage)' },
  { id: 'property', label: 'PropertyOS', path: '/property', icon: 'real_estate_agent', color: 'var(--sky-wash)' },
  { id: 'freight', label: 'FreightOS', path: '/freight', icon: 'local_shipping', color: 'var(--muted-ochre)' },
  { id: 'ledger', label: 'LedgerOS', path: '/ledger', icon: 'account_balance', color: 'var(--dusty-rose)' },
];

export function ModuleSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const currentModule = modules.find(m => location.pathname.startsWith(m.path)) || { label: 'Dashboard', icon: 'dashboard', color: 'var(--warm-ink)' };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[rgba(0,0,0,0.05)] transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]" style={{ color: currentModule.color }}>
          {currentModule.icon}
        </span>
        <span className="font-semibold text-sm text-[var(--warm-ink)] hidden sm:block">
          {currentModule.label}
        </span>
        <span className="material-symbols-outlined text-[16px] text-[var(--soft-stone)]">
          expand_more
        </span>
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
              className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 bg-white rounded-2xl shadow-xl border border-[rgba(191,179,163,0.2)] overflow-hidden z-50"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <div className="py-1">
                {modules.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      navigate(m.path);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[rgba(0,0,0,0.03)] transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: m.color }}>
                      {m.icon}
                    </span>
                    <span className="text-sm font-medium text-[var(--warm-ink)]">
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
