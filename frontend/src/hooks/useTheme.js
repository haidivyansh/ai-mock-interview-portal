import { useState, useEffect } from 'react';

/**
 * Manages dark/light mode by toggling the 'dark' class on <html>.
 * Persists the user's preference to localStorage.
 * Falls back to the OS preference on first visit.
 */
const useTheme = () => {
  const getInitial = () => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const [isDark, setIsDark] = useState(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggle = () => setIsDark((v) => !v);

  return { isDark, toggle };
};

export default useTheme;
