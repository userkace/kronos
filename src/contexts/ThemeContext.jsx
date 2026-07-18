import { createContext, useContext, useEffect, useState } from 'react';

// App-wide (not workspace-scoped) and device-local by design: theme is a
// property of the screen you're looking at, so it's never cloud-synced.
const STORAGE_KEY = 'kronos_theme'; // 'light' | 'dark' | 'system'

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const getStoredTheme = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'system' || stored === 'light' ? stored : 'light';
  } catch {
    return 'light';
  }
};

const getResolvedDark = (theme) =>
  theme === 'dark' ||
  (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getStoredTheme);
  // The *effective* dark state ('system' resolved against the OS preference),
  // for the rare styles that can't come from CSS — e.g. JS-driven animation
  // keyframes, where inline styles would beat any .dark override.
  const [isDark, setIsDark] = useState(() => getResolvedDark(getStoredTheme()));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable — theme still applies for this session.
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);
    };
    apply();
    if (theme === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
