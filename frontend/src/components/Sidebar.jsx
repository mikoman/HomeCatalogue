import { Link } from 'react-router-dom';
import { useState } from 'react';
import { houses as housesApi, rooms as roomsApi } from '../api/client';

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
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-surface-900 border-r border-surface-800
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col safe-top
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-surface-800">
          <Link to="/houses" onClick={onClose} className="flex items-center gap-2">
            <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-lg font-bold text-surface-100">Home Catalogue</span>
          </Link>
        </div>

        {/* Houses list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {houses.map(house => (
            <div key={house.id} className="rounded-lg overflow-hidden">
              <button
                onClick={() => toggleHouse(house.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-800 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-5 h-5 text-surface-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="text-surface-200 font-medium truncate">{house.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-surface-500">
                    {(rooms[house.id] || []).length}
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
                      <Link
                        to={`/rooms/${room.id}`}
                        onClick={() => { onClose?.(); }}
                        className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-800 transition-colors text-left text-sm"
                      >
                        <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-surface-400 truncate">{room.name}</span>
                      </Link>
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
                    <form onSubmit={(e) => handleAddRoom(house.id)} className="flex gap-1 px-3 py-1">
                      <input
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Room name..."
                        className="input-field text-sm py-1.5"
                        autoFocus
                      />
                      <button type="submit" className="btn-primary text-xs px-2">Add</button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowAddRoom(house.id)}
                      className="flex items-center gap-2 px-3 py-2 text-surface-500 hover:text-surface-300 text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Room
                    </button>
                  )}
                </div>
              )}

              {/* Delete house */}
              <button
                onClick={(e) => handleDeleteHouse(house.id, e)}
                className="w-full text-left px-3 py-1 text-xs text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete house
              </button>
            </div>
          ))}

          {/* Add house */}
          {showAddHouse ? (
            <form onSubmit={handleAddHouse} className="flex gap-1 px-3 py-1">
              <input
                value={newHouseName}
                onChange={(e) => setNewHouseName(e.target.value)}
                placeholder="House name..."
                className="input-field text-sm py-1.5"
                autoFocus
              />
              <button type="submit" className="btn-primary text-xs px-2">Add</button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddHouse(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-surface-500 hover:text-surface-300 hover:bg-surface-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add House
            </button>
          )}
        </nav>
      </aside>
    </>
  );
}
