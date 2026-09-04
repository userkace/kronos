import { createContext, useContext, useEffect, useState } from 'react';

// App-wide (not workspace-scoped) and device-local by design: theme is a
// property of the screen you're looking at, so it's never cloud-synced.
const STORAGE_KEY = 'kronos_theme'; // 'light' | 'dark' | 'system'
// Which flavour of dark to use once dark is in effect: 'midnight' is the
// blue-tinted original, 'charcoal' the neutral near-black one.
const TONE_STORAGE_KEY = 'kronos_dark_tone'; // 'midnight' | 'charcoal'
const DARK_TONES = ['midnight', 'charcoal'];

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

const getStoredDarkTone = () => {
  try {
    const stored = localStorage.getItem(TONE_STORAGE_KEY);
    return DARK_TONES.includes(stored) ? stored : 'midnight';
  } catch {
    return 'midnight';
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
  const [darkTone, setDarkTone] = useState(getStoredDarkTone);

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

  useEffect(() => {
    try {
      localStorage.setItem(TONE_STORAGE_KEY, darkTone);
    } catch {
      // Storage unavailable — tone still applies for this session.
    }
    // Harmless in light mode: the charcoal rules are all scoped to `.dark`.
    document.documentElement.classList.toggle('tone-charcoal', darkTone === 'charcoal');
  }, [darkTone]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, darkTone, setDarkTone }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
