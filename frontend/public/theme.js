/* Apply the saved theme before the first paint. */
(() => {
  const key = 'homeCatalogue:theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const listeners = new Set();
  const readPreference = () => {
    try {
      const value = window.localStorage.getItem(key);
      return value === 'light' || value === 'dark' ? value : null;
    } catch { return null; }
  };
  let preference = readPreference();
  let theme;
  const apply = () => {
    theme = preference || (system.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#131e19' : '#f5f2eb');
    listeners.forEach(listener => listener());
  };
  window.homeCatalogueTheme = {
    getTheme: () => theme,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    setTheme: value => {
      if (value !== 'light' && value !== 'dark') return;
      preference = value;
      try { window.localStorage.setItem(key, value); } catch { /* Keep the choice for this page when storage is blocked. */ }
      apply();
    },
  };
  system.addEventListener('change', () => { if (!preference) apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = readPreference(); apply(); }
  });
  apply();
})();
