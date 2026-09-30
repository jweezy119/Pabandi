import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

const ALL_MODULES = [
  { id: 'contact', label: 'ContactOS', path: '/contact', icon: 'contacts', color: 'var(--clay)', modes: ['BUSINESS', 'CUSTOMER'] },
  { id: 'booking', label: 'BookingOS', path: '/booking', icon: 'book_online', color: 'var(--sage)', modes: ['BUSINESS', 'CUSTOMER'] },
  { id: 'property', label: 'PropertyOS', path: '/property', icon: 'real_estate_agent', color: 'var(--sky-wash)', modes: ['BUSINESS', 'CUSTOMER'] },
  { id: 'freight', label: 'FreightOS', path: '/freight', icon: 'local_shipping', color: 'var(--muted-ochre)', modes: ['BUSINESS', 'CUSTOMER'] },
  { id: 'capital', label: 'CapitalOS', path: '/capital', icon: 'account_balance', color: 'var(--dusty-rose)', modes: ['BUSINESS', 'CUSTOMER'] },
];

export function ModuleSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const activeMode = user?.preferredMode || 'business';
  const modules = ALL_MODULES.filter(m => m.modes.includes(activeMode.toUpperCase()));
  const currentModule = modules.find(m => location.pathname.startsWith(m.path)) || modules[0];

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[rgba(0,0,0,0.05)] transition-colors"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="material-symbols-outlined text-[18px]" style={{ color: currentModule.color }}>
          {currentModule.icon}
        </span>
        <span className="font-semibold text-sm text-[var(--warm-ink)] hidden sm:block">
          {currentModule.label}
        </span>
        <motion.span
          className="material-symbols-outlined text-[16px] text-[var(--soft-stone)]"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.9, 0.35, 1] }}
        >
          expand_more
        </motion.span>
      </motion.button>

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
              transition={{ duration: 0.2, ease: [0.25, 0.9, 0.35, 1] }}
            >
              <motion.div
                className="py-1"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ staggerChildren: 0.05 }}
              >
                {modules.map((m, index) => (
                  <motion.button
                    key={m.id}
                    onClick={() => {
                      navigate(m.path);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[rgba(0,0,0,0.03)] transition-colors text-left"
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      show: {
                        opacity: 1,
                        x: 0,
                        transition: {
                          type: 'spring',
                          stiffness: 380,
                          damping: 30,
                          delay: index * 0.05,
                        },
                      },
                    }}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: m.color }}>
                      {m.icon}
                    </span>
                    <span className="text-sm font-medium text-[var(--warm-ink)]">
                      {m.label}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
