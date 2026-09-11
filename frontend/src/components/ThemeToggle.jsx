import { useSyncExternalStore } from 'react';
import Icon from './Icon';

export default function ThemeToggle() {
  const theme = useSyncExternalStore(window.homeCatalogueTheme.subscribe, window.homeCatalogueTheme.getTheme);
  const dark = theme === 'dark';
  return <button type="button" role="switch" aria-checked={dark} aria-label="Dark mode"
    title={`Switch to ${dark ? 'light' : 'dark'} mode`}
    onClick={() => window.homeCatalogueTheme.setTheme(dark ? 'light' : 'dark')}
    className="theme-toggle">
    <Icon name={dark ? 'moon' : 'sun'} className="w-4 h-4" />
    <span className="hidden sm:inline">Dark mode</span>
    <span className="theme-toggle-track" aria-hidden="true"><span /></span>
  </button>;
}
