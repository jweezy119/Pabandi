import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

export function ModeToggle() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, toggleMode } = useAuthStore();

  const currentMode = user?.preferredMode || 'business';
  const isBusiness = currentMode === 'business';

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const newMode = isBusiness ? 'personal' : 'business';
      await toggleMode(newMode);
      navigate(newMode === 'business' ? '/contact' : '/me');
    } catch (err) {
      console.error('Failed to toggle mode:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.button
      onClick={handleToggle}
      disabled={isLoading}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
      style={{
        background: isBusiness ? 'var(--clay)' : 'var(--sage)',
        color: 'white',
        borderColor: isBusiness ? 'var(--clay)' : 'var(--sage)',
      }}
      whileTap={{ scale: 0.95 }}
    >
      <span>{isBusiness ? 'Business' : 'Personal'}</span>
      <span className="opacity-80">→</span>
      <span>{isBusiness ? 'Personal' : 'Business'}</span>
    </motion.button>
  );
}
