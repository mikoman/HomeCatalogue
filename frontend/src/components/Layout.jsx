import { useState, useEffect, useCallback } from 'react';
import { useLocation, NavLink, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';
import Icon from './Icon';

export default function Layout({ children, houses, rooms }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const location = useLocation();
  const closeMenu = useCallback(() => setSidebarOpen(false), []);
  useEffect(closeMenu, [location.pathname, closeMenu]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const update = () => { if (desktop.matches) closeMenu(); };
    desktop.addEventListener('change', update);
    return () => desktop.removeEventListener('change', update);
  }, [closeMenu]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return (
    <div className="h-dvh max-h-dvh bg-surface-950 flex overflow-hidden">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {sidebarOpen && <div className="fixed inset-0 bg-black/70 z-40 lg:hidden" onClick={closeMenu} />}
      <Sidebar houses={houses} rooms={rooms} isOpen={sidebarOpen} onClose={closeMenu} />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col lg:ml-64" inert={sidebarOpen ? '' : undefined}>
        <header className="safe-top shrink-0 bg-surface-950 border-b border-surface-800 z-30">
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden icon-button" aria-label="Open menu" aria-expanded={sidebarOpen} aria-controls="catalogue-menu"><Icon name="menu" /></button>
            <Link to="/houses" className="hidden md:block font-display font-semibold text-surface-100">Your things, easy to find.</Link>
            <div className="flex-1 min-w-0 md:max-w-md md:ml-auto"><SearchBar /></div>
          </div>
          {!online && <p role="status" className="px-4 py-2 text-sm bg-primary-900/40 text-primary-200">You are offline. Reconnect to upload photos or save changes.</p>}
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="max-w-5xl mx-auto w-full min-w-0 px-4 sm:px-6 py-6 sm:py-8">{children}</div>
        </main>
        <nav aria-label="Main navigation" className="mobile-nav lg:hidden grid grid-cols-3 border-t border-surface-700 bg-surface-900 shrink-0 safe-bottom">
          {[['/houses', 'home', 'Catalogue'], ['/capture', 'camera', 'Scan'], ['/search', 'search', 'Find']].map(([to, icon, label]) => <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium ${isActive ? 'text-primary-400' : 'text-surface-400'}`}><Icon name={icon} /><span>{label}</span></NavLink>)}
        </nav>
      </div>
    </div>
  );
}
