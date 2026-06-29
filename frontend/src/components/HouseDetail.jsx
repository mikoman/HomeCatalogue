import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { houses as housesApi, rooms as roomsApi } from '../api/client';

export default function HouseDetail() {
  const { houseId } = useParams();
  const navigate = useNavigate();
  const [house, setHouse] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    loadData();
  }, [houseId]);

  const loadData = async () => {
    try {
      const [houseData, roomsData] = await Promise.all([
        housesApi.get(houseId),
        roomsApi.list(houseId),
      ]);
      setHouse(houseData);
      setRooms(roomsData);
    } catch (err) {
      console.error('Failed to load house:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      const room = await roomsApi.create({ house_id: parseInt(houseId), name: newRoomName.trim() });
      setRooms(prev => [...prev, room]);
      setNewRoomName('');
      setShowCreateRoom(false);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Delete this room and all its items?')) return;
    try {
      await roomsApi.delete(roomId);
      setRooms(prev => prev.filter(r => r.id !== roomId));
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-surface-800 border-t-primary-500"></div>
      </div>
    );
  }

  if (!house) {
    return (
      <div className="card border-red-900 bg-red-950/30">
        <p className="text-red-400">House not found.</p>
        <button onClick={() => navigate('/houses')} className="btn-secondary mt-3">Back to index</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-rise">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate('/houses')}
            className="font-mono text-[0.7rem] uppercase tracking-wider text-surface-500 hover:text-primary-400 mb-2 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Index
          </button>
          <h2 className="font-display text-3xl font-bold tracking-tight text-surface-100 truncate">{house.name}</h2>
          {house.description && (
            <p className="text-surface-400 mt-1">{house.description}</p>
          )}
          <p className="mt-2 font-mono text-[0.7rem] text-surface-500 tracking-wider">
            {rooms.length} {rooms.length === 1 ? 'ROOM' : 'ROOMS'}
          </p>
        </div>
        <button onClick={() => setShowCreateRoom(true)} className="btn-primary self-start sm:self-auto">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add room
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="card text-center py-14">
          <div className="w-14 h-14 rounded-lg bg-surface-800 grid place-items-center mx-auto mb-4">
            <svg className="w-7 h-7 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-surface-200 mb-1">No rooms yet</h3>
          <p className="text-surface-500 mb-5">Add rooms, then scan each one to fill the catalogue.</p>
          <button onClick={() => setShowCreateRoom(true)} className="btn-primary mx-auto">
            Add your first room
          </button>
        </div>
      ) : (
        <div>
          <p className="eyebrow mb-3">Rooms</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room, i) => (
              <button
                key={room.id}
                onClick={() => navigate(`/rooms/${room.id}`)}
                className="card group text-left hover:border-primary-500/60 hover:-translate-y-0.5
                           transition-all duration-200 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[0.7rem] text-surface-500 tracking-wider">
                    R-{String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-surface-500 hover:text-red-400 transition-all cursor-pointer"
                    aria-label="Delete room"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </span>
                </div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h3 className="font-display text-lg font-semibold text-surface-100 truncate">{room.name}</h3>
                </div>
                {room.description ? (
                  <p className="text-sm text-surface-500 line-clamp-2">{room.description}</p>
                ) : (
                  <p className="text-sm text-surface-600 italic">No description</p>
                )}
                <span className="mt-4 pt-3 border-t border-surface-800 font-mono text-[0.7rem] uppercase tracking-wider
                                 text-surface-500 group-hover:text-primary-500 transition-colors flex items-center gap-1.5">
                  Open location
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create room modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateRoom(false)}>
          <div className="card w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow mb-1">New record</p>
            <h3 className="font-display text-xl font-semibold text-surface-100 mb-4">Add a room</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block font-mono text-[0.7rem] uppercase tracking-wider text-surface-400 mb-1.5">Room name</label>
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Kitchen, Garage, Hall closet"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => setShowCreateRoom(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add room</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
