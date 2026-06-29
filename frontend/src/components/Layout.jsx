import { useState } from 'react';
import { useLocation } from 'react-router-dom';
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
    'CATALOGUE';

  return (
    <div className="min-h-screen bg-surface-950 flex overflow-x-hidden">
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
      <div className="flex-1 min-w-0 flex flex-col min-h-screen lg:ml-64">
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
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse-soft flex-shrink-0" />
              <span className="eyebrow truncate">{section}</span>
            </div>
            <div className="flex-1 min-w-0 max-w-md ml-auto">
              <SearchBar />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-5xl mx-auto w-full min-w-0 px-4 sm:px-6 py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
