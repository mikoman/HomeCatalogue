import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Icon from './Icon';

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
    <aside ref={panel} id="catalogue-menu" aria-label="Catalogue navigation" className={`folio-sidebar fixed inset-y-0 left-0 z-50 w-56 border-r flex-col safe-top safe-bottom ${isOpen ? 'flex' : 'hidden lg:flex'}`}>
      <div className="flex items-center justify-between px-5 py-8">
        <Link to="/houses" onClick={onClose} className="flex items-center gap-4 font-display text-xl leading-tight"><span className="folio-mark" aria-hidden="true"><span /><span /><span /><span /></span><span>Home<br />Catalogue</span></Link>
        <button onClick={onClose} className="lg:hidden min-h-11 min-w-11 grid place-items-center rounded-md" aria-label="Close menu"><Icon name="close" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-5 space-y-1">
        <NavLink to="/houses" end className="folio-nav-item" onClick={onClose}><Icon name="archive" />Catalogue</NavLink>
        <NavLink to="/capture" className="folio-nav-item" onClick={onClose}><Icon name="camera" />Scan a space</NavLink>
        <NavLink to="/search" className="folio-nav-item" onClick={onClose}><Icon name="search" />Find an item</NavLink>
        <div className="folio-nav-divider border-t !mt-7 !mb-4 mx-3" />
        {houses.map(house => {
          const houseRooms = rooms.filter(room => room.house_id === house.id);
          const active = houseRooms.some(room => location.pathname === `/rooms/${room.id}`);
          return <details key={`${house.id}:${active}`} open={active || houses.length === 1}>
            <summary className="folio-nav-muted px-3 py-3 text-sm cursor-pointer break-words">{house.name}</summary>
            <div>
              {houseRooms.map(room => <NavLink key={room.id} to={`/rooms/${room.id}`} className="folio-nav-item" onClick={onClose}><Icon name="room" className="w-4 h-4 shrink-0" /><span className="truncate">{room.name}</span></NavLink>)}
              <Link to={`/houses/${house.id}`} onClick={onClose} className="folio-nav-muted block px-3 py-3 text-sm underline">Manage rooms</Link>
            </div>
          </details>;
        })}
        {!houses.length && <p className="folio-nav-muted px-3 text-sm">Your rooms will appear here.</p>}
      </nav>
      <div className="folio-nav-divider border-t p-3 space-y-1">
        <NavLink to="/failed-scans" className="folio-nav-item" onClick={onClose}><Icon name="warning" />Scans to retry</NavLink>
        <NavLink to="/settings" className="folio-nav-item" onClick={onClose}><Icon name="settings" />Settings</NavLink>
      </div>
    </aside>
  );
}
