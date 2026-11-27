import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'pabandi-theme';
const THEME_EVENT = 'pabandi-theme-change';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a1118' : '#F5EFE6');
  root.style.colorScheme = theme;
}

/** Animate only paint properties — never layout/transform — and honor reduced motion. */
function applyWithTransition(next: ThemeMode) {
  const root = document.documentElement;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const commit = () => applyTheme(next);
  if (reduced) return commit();
  const startVT = (document as any).startViewTransition;
  if (typeof startVT === 'function') {
    startVT.call(document, commit);
    return;
  }
  root.classList.add('theme-transition');
  commit();
  window.setTimeout(() => root.classList.remove('theme-transition'), 240);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const sync = (e: Event) => {
      const next = (e as CustomEvent<ThemeMode>).detail;
      if (next === 'dark' || next === 'light') {
        setThemeState(next);
      }
    };
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    applyWithTransition(next);
    setThemeState(next);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, isDark: theme === 'dark', setTheme, toggleTheme };
}
