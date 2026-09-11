import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Icon from './Icon';

const navClass = ({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-surface-800 text-primary-400' : 'text-surface-300 hover:bg-surface-800'}`;

export default function Sidebar({ houses, rooms, isOpen, onClose }) {
  const location = useLocation();
  const panel = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    panel.current?.querySelector('button')?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('a, button, summary')].filter(el => el.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [isOpen, onClose]);

  return (
    <aside ref={panel} id="catalogue-menu" aria-label="Catalogue navigation" className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-900 border-r border-surface-800 flex-col safe-top safe-bottom ${isOpen ? 'flex' : 'hidden lg:flex'}`}>
      <div className="flex items-center justify-between px-5 py-6">
        <Link to="/houses" onClick={onClose} className="flex items-center gap-3 font-display font-semibold text-surface-100"><span className="p-2 rounded-lg bg-primary-500 text-surface-950"><Icon name="home" /></span>Home Catalogue</Link>
        <button onClick={onClose} className="lg:hidden icon-button" aria-label="Close menu"><Icon name="close" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-5 space-y-1">
        <NavLink to="/houses" end className={navClass} onClick={onClose}><Icon name="home" />Your catalogue</NavLink>
        <NavLink to="/capture" className={navClass} onClick={onClose}><Icon name="camera" />Scan a space</NavLink>
        <NavLink to="/search" className={navClass} onClick={onClose}><Icon name="search" />Find an item</NavLink>
        <div className="pt-6 pb-2 px-3 text-sm text-surface-400">Your places</div>
        {houses.map(house => {
          const houseRooms = rooms.filter(room => room.house_id === house.id);
          const active = houseRooms.some(room => location.pathname === `/rooms/${room.id}`);
          return <details key={`${house.id}:${active}`} open={active || houses.length === 1} className="group">
            <summary className="px-3 py-3 text-surface-200 cursor-pointer rounded-lg hover:bg-surface-800 break-words">{house.name}</summary>
            <div className="ml-3 pl-2 border-l border-surface-700">
              {houseRooms.map(room => <NavLink key={room.id} to={`/rooms/${room.id}`} className={navClass} onClick={onClose}><Icon name="room" className="w-4 h-4 shrink-0" /><span className="truncate">{room.name}</span></NavLink>)}
              <Link to={`/houses/${house.id}`} onClick={onClose} className="block px-3 py-3 text-sm text-surface-400 hover:text-primary-400">Manage rooms</Link>
            </div>
          </details>;
        })}
        {!houses.length && <p className="px-3 text-sm text-surface-400">Your rooms will appear here.</p>}
      </nav>
      <div className="border-t border-surface-800 p-3 space-y-1">
        <NavLink to="/failed-scans" className={navClass} onClick={onClose}><Icon name="warning" />Scans to retry</NavLink>
        <NavLink to="/settings" className={navClass} onClick={onClose}><Icon name="settings" />Settings</NavLink>
      </div>
    </aside>
  );
}
