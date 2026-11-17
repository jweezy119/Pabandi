import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors touch-target compact-touch ${
        isDark
          ? 'bg-[#101a24] border-white/15 text-[#4fd1c5] hover:bg-white/10'
          : 'bg-white/80 border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]/60'
      } ${className}`}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </motion.button>
  );
}
