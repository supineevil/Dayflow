import { useEffect } from 'react';
import { usePrefs } from './usePrefs';

/**
 * Applies the stored theme to <html> and mirrors it into localStorage, which
 * theme-init.js reads synchronously on the next load to avoid a flash.
 */
export function useTheme() {
  const { prefs } = usePrefs();
  const theme = prefs.theme;

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    try {
      localStorage.setItem('dayflow-theme', theme);
    } catch {
      /* ignore: only affects first-paint flash */
    }
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
