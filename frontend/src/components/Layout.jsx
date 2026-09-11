import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useLocation, NavLink, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';
import ThemeToggle from './ThemeToggle';
import Icon from './Icon';

export default function Layout({ children, houses, rooms }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const main = useRef(null);
  const location = useLocation();
  const inRoom = /^\/rooms\/[^/]+$/.test(location.pathname);
  const pageHasSearch = inRoom || location.pathname === '/search';
  const closeMenu = useCallback(() => setSidebarOpen(false), []);
  useEffect(closeMenu, [location.pathname, closeMenu]);
  useLayoutEffect(() => { if (main.current) main.current.scrollTop = 0; }, [location.pathname]);
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
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={closeMenu} />}
      <Sidebar houses={houses} rooms={rooms} isOpen={sidebarOpen} onClose={closeMenu} />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col lg:ml-56" inert={sidebarOpen ? '' : undefined}>
        <header className={`safe-top shrink-0 bg-surface-950 border-b border-surface-800 z-30 ${inRoom && online ? 'lg:absolute lg:top-1 lg:right-0 lg:border-0' : ''}`}>
          <div className="flex items-center gap-2 sm:gap-4 px-4 sm:px-8 py-2">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden icon-button shrink-0" aria-label="Open menu" aria-expanded={sidebarOpen} aria-controls="catalogue-menu"><Icon name="menu" /></button>
            <Link to="/houses" className={`font-display text-sm sm:text-base text-surface-200 shrink-0 ${inRoom && online ? 'lg:hidden' : ''}`}>Home Catalogue</Link>
            <div className="ml-auto flex items-center gap-3 min-w-0">
              {!pageHasSearch && <div className="hidden md:block w-64"><SearchBar /></div>}
              <ThemeToggle />
            </div>
          </div>
          {!online && <p role="status" className="px-4 py-2 text-sm bg-primary-900/40 text-primary-200">You are offline. Reconnect to upload photos or save changes.</p>}
        </header>
        <main ref={main} id="main-content" tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="max-w-6xl mx-auto w-full min-w-0 px-4 sm:px-8 py-5 sm:py-7">{children}</div>
        </main>
        <nav aria-label="Main navigation" className="mobile-nav lg:hidden grid grid-cols-3 border-t border-surface-700 bg-surface-950 shrink-0 safe-bottom">
          <NavLink to="/houses" className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium ${isActive || inRoom ? 'text-primary-400' : 'text-surface-400'}`}><Icon name="archive" /><span>Catalogue</span></NavLink>
          {inRoom
            ? <button type="button" onClick={() => window.dispatchEvent(new Event('catalogue:capture'))} className="flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-semibold text-primary-400"><Icon name="camera" /><span>Scan</span></button>
            : <NavLink to="/capture" className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium ${isActive ? 'text-primary-400' : 'text-surface-400'}`}><Icon name="camera" /><span>Scan</span></NavLink>}
          <NavLink to="/search" className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium ${isActive ? 'text-primary-400' : 'text-surface-400'}`}><Icon name="search" /><span>Find</span></NavLink>
        </nav>
      </div>
    </div>
  );
}
