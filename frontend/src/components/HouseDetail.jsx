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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!house) {
    return (
      <div className="card border-red-800">
        <p className="text-red-400">House not found</p>
        <button onClick={() => navigate('/houses')} className="btn-secondary mt-3">Back to Houses</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/houses')}
            className="text-sm text-surface-500 hover:text-surface-300 mb-2 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Houses
          </button>
          <h2 className="text-2xl font-bold text-surface-100">{house.name}</h2>
          {house.description && (
            <p className="text-surface-500 mt-1">{house.description}</p>
          )}
        </div>
        <button onClick={() => setShowCreateRoom(true)} className="btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-surface-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-medium text-surface-300 mb-2">No rooms yet</h3>
          <p className="text-surface-500 mb-4">Add rooms to start organizing your inventory</p>
          <button onClick={() => setShowCreateRoom(true)} className="btn-primary">
            Add Your First Room
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms.map(room => (
            <div
              key={room.id}
              className="card group hover:border-primary-800 transition-all cursor-pointer"
              onClick={() => navigate(`/rooms/${room.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <h3 className="text-lg font-semibold text-surface-100">{room.name}</h3>
                  </div>
                  {room.description && (
                    <p className="text-sm text-surface-500">{room.description}</p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.id); }}
                  className="opacity-0 group-hover:opacity-100 p-2 text-surface-500 hover:text-red-400 transition-all"
                  aria-label="Delete room"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create room modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateRoom(false)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-surface-100 mb-4">Add Room</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-400 mb-1">Room Name</label>
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g., Kitchen, Living Room, Garage"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowCreateRoom(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add Room</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
