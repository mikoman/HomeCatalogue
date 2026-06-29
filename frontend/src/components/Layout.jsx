import { useState } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';

export default function Layout({ children, houses, setHouses }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const section =
    location.pathname === '/houses' ? 'INDEX' :
    location.pathname.startsWith('/houses/') ? 'PROPERTY' :
    location.pathname.startsWith('/rooms/') ? 'LOCATION' :
    location.pathname === '/review-scan' ? 'REVIEW' :
    location.pathname === '/settings' ? 'SETTINGS' :
    location.pathname === '/search' ? 'SEARCH' :
    location.pathname === '/failed-scans' ? 'FAILED' :
    'CATALOGUE';

  return (
    <div className="h-dvh max-h-dvh bg-surface-950 flex overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        houses={houses}
        setHouses={setHouses}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col lg:ml-64">
        {/* Top bar */}
        <header className="safe-top sticky top-0 z-30 bg-surface-950/85 backdrop-blur-xl border-b border-surface-800">
          {/* hazard hairline */}
          <div className="hazard h-[3px] w-full opacity-80" />
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-surface-800 transition-colors text-surface-300"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2 min-w-0 flex-1 lg:flex-none">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse-soft flex-shrink-0" />
              <span className="eyebrow truncate">{section}</span>
            </div>
            <NavLink
              to="/settings"
              className={({ isActive }) => `lg:hidden flex-shrink-0 p-2 rounded-md transition-colors ${
                isActive ? 'text-primary-400 bg-surface-800' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
              }`}
              aria-label="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </NavLink>
            <div className="flex-1 min-w-0 max-w-md lg:ml-auto">
              <SearchBar />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="max-w-5xl mx-auto w-full min-w-0 px-4 sm:px-6 py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
