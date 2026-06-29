import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { houses as housesApi, rooms as roomsApi } from '../api/client';

function SettingsLink({ onClose, className = '' }) {
  return (
    <NavLink
      to="/settings"
      onClick={() => onClose?.()}
      className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${className} ${
        isActive
          ? 'bg-surface-800 text-primary-400'
          : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
      }`}
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      Settings
    </NavLink>
  );
}

export default function Sidebar({ houses, setHouses, isOpen, onClose }) {
  const [expandedHouses, setExpandedHouses] = useState({});
  const [rooms, setRooms] = useState({});
  const [showAddHouse, setShowAddHouse] = useState(false);
  const [newHouseName, setNewHouseName] = useState('');
  const [showAddRoom, setShowAddRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState('');

  const toggleHouse = async (houseId) => {
    const isExpanded = expandedHouses[houseId];
    setExpandedHouses(prev => ({ ...prev, [houseId]: !isExpanded }));

    if (!isExpanded && !rooms[houseId]) {
      try {
        const houseRooms = await roomsApi.list(houseId);
        setRooms(prev => ({ ...prev, [houseId]: houseRooms }));
      } catch (err) {
        console.error('Failed to load rooms:', err);
      }
    }
  };

  const handleAddHouse = async (e) => {
    e.preventDefault();
    if (!newHouseName.trim()) return;
    try {
      const house = await housesApi.create({ name: newHouseName.trim() });
      setHouses(prev => [...prev, house]);
      setNewHouseName('');
      setShowAddHouse(false);
    } catch (err) {
      console.error('Failed to add house:', err);
    }
  };

  const handleAddRoom = async (houseId) => {
    if (!newRoomName.trim()) return;
    try {
      const room = await roomsApi.create({ house_id: houseId, name: newRoomName.trim() });
      setRooms(prev => ({
        ...prev,
        [houseId]: [...(prev[houseId] || []), room],
      }));
      setNewRoomName('');
      setShowAddRoom(null);
    } catch (err) {
      console.error('Failed to add room:', err);
    }
  };

  const handleDeleteHouse = async (houseId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this house and all its rooms?')) return;
    try {
      await housesApi.delete(houseId);
      setHouses(prev => prev.filter(h => h.id !== houseId));
    } catch (err) {
      console.error('Failed to delete house:', err);
    }
  };

  const handleDeleteRoom = async (houseId, roomId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this room and all its items?')) return;
    try {
      await roomsApi.delete(roomId);
      setRooms(prev => ({
        ...prev,
        [houseId]: (prev[houseId] || []).filter(r => r.id !== roomId),
      }));
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  return (
    <>
      <aside className={`
        fixed lg:fixed top-0 left-0 z-50 h-dvh max-h-dvh w-64 bg-surface-900 border-r border-surface-800
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col min-h-0 safe-top safe-bottom
      `}>
        {/* Brand */}
        <div className="flex-shrink-0 p-4 border-b border-surface-800">
          <Link to="/houses" onClick={onClose} className="flex items-center gap-3 group">
            <span className="w-9 h-9 rounded-md bg-primary-500 grid place-items-center flex-shrink-0
                             shadow-sm group-hover:shadow-glow transition-shadow">
              <svg className="w-5 h-5 text-surface-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block font-display font-bold text-surface-100 tracking-tight">Home Catalogue</span>
              <span className="block eyebrow mt-0.5">Inventory System</span>
            </span>
          </Link>
        </div>

        {/* Settings — top of sidebar on mobile so it stays reachable */}
        <div className="flex-shrink-0 px-3 pt-2 pb-3 border-b border-surface-800 lg:hidden">
          <SettingsLink onClose={onClose} />
        </div>

        {/* Houses list — scrolls independently; footer stays pinned */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-1">
          <p className="eyebrow px-3 pb-2 pt-1">Properties</p>
          {houses.map(house => (
            <div key={house.id} className="group/house rounded-md overflow-hidden">
              <button
                onClick={() => toggleHouse(house.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-surface-800 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-5 h-5 text-surface-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="text-surface-200 font-medium truncate">{house.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[0.7rem] text-surface-500">
                    {String((rooms[house.id] || []).length).padStart(2, '0')}
                  </span>
                  <svg
                    className={`w-4 h-4 text-surface-500 transition-transform ${expandedHouses[house.id] ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Rooms */}
              {expandedHouses[house.id] && (
                <div className="ml-4 pl-4 border-l border-surface-800 space-y-0.5 pb-2">
                  {(rooms[house.id] || []).map(room => (
                    <div key={room.id} className="group flex items-center">
                      <NavLink
                        to={`/rooms/${room.id}`}
                        onClick={() => { onClose?.(); }}
                        className={({ isActive }) => `flex-1 flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left text-sm border-l-2 ${
                          isActive
                            ? 'bg-surface-800 border-primary-500 text-surface-100'
                            : 'border-transparent hover:bg-surface-800 text-surface-400'
                        }`}
                      >
                        <svg className="w-4 h-4 text-surface-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="truncate">{room.name}</span>
                      </NavLink>
                      <button
                        onClick={(e) => handleDeleteRoom(house.id, room.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-surface-500 hover:text-red-400 transition-all"
                        aria-label="Delete room"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {/* Add room */}
                  {showAddRoom === house.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleAddRoom(house.id); }} className="flex gap-1 px-3 py-1">
                      <input
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Room name…"
                        className="input-field text-sm py-1.5"
                        autoFocus
                      />
                      <button type="submit" className="btn-primary text-xs px-2.5">Add</button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowAddRoom(house.id)}
                      className="flex items-center gap-2 px-3 py-2 text-surface-500 hover:text-primary-400 text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add room
                    </button>
                  )}
                </div>
              )}

              {/* Delete house */}
              <button
                onClick={(e) => handleDeleteHouse(house.id, e)}
                className="w-full text-left px-3 py-1 font-mono text-[0.62rem] uppercase tracking-wider text-surface-600 hover:text-red-400 opacity-0 group-hover/house:opacity-100 transition-opacity"
              >
                Delete property
              </button>
            </div>
          ))}

          {/* Add house */}
          {showAddHouse ? (
            <form onSubmit={handleAddHouse} className="flex gap-1 px-3 py-1">
              <input
                value={newHouseName}
                onChange={(e) => setNewHouseName(e.target.value)}
                placeholder="House name…"
                className="input-field text-sm py-1.5"
                autoFocus
              />
              <button type="submit" className="btn-primary text-xs px-2.5">Add</button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddHouse(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 text-surface-400 hover:text-primary-400 hover:bg-surface-800 rounded-md transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium text-sm">Add property</span>
            </button>
          )}
        </nav>

        {/* Footer — always visible on desktop */}
        <div className="flex-shrink-0 px-3 py-3 border-t border-surface-800 bg-surface-900 space-y-1">
          <div className="hidden lg:block">
            <SettingsLink onClose={onClose} />
          </div>
          <p className="font-mono text-[0.62rem] text-surface-600 tracking-wider px-3 pt-1">
            {houses.length} {houses.length === 1 ? 'PROPERTY' : 'PROPERTIES'} ON FILE
          </p>
        </div>
      </aside>
    </>
  );
}
