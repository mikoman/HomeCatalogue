import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { rooms as roomsApi, containers as containersApi, items as itemsApi } from '../api/client';

/**
 * Move picker modal. Moves items (multi) or a container (single) to another
 * room within the same house. In item mode the user picks a room then
 * optionally a container in it (or "Loose in this room"). In container mode
 * the container becomes a root in the target room (no sub-select).
 *
 * Props:
 *  - sourceRoomId: number — derives the house to scope candidate rooms.
 *  - mode: 'item' | 'container'
 *  - itemIds: number[]   (mode === 'item')
 *  - containerId: number (mode === 'container')
 *  - onDone: () => void  — caller refreshes data + clears selection.
 *  - onClose: () => void — close the modal.
 */
export default function MovePicker({ sourceRoomId, mode, itemIds, containerId, onDone, onClose }) {
  const [rooms, setRooms] = useState([]);
  const [targetRoomId, setTargetRoomId] = useState(null);
  const [containers, setContainers] = useState([]);
  const [targetContainerId, setTargetContainerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState(null);

  // Load the source room (for house_id) then same-house rooms.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const source = await roomsApi.get(sourceRoomId);
        const roomList = await roomsApi.list(source.house_id);
        if (cancelled) return;
        setRooms(roomList);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sourceRoomId]);

  // When the target room changes, load its containers (item mode only).
  useEffect(() => {
    if (mode !== 'item' || targetRoomId == null) return;
    setTargetContainerId(null);
    setContainers([]);
    let cancelled = false;
    (async () => {
      try {
        const list = await containersApi.list(targetRoomId, null, { includeAll: true });
        if (!cancelled) setContainers(list);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, targetRoomId]);

  const handleConfirm = async () => {
    if (targetRoomId == null) return;
    setMoving(true);
    setError(null);
    try {
      if (mode === 'item') {
        await itemsApi.move({
          itemIds,
          roomId: targetRoomId,
          containerId: targetContainerId,
        });
      } else {
        await containersApi.move(containerId, { roomId: targetRoomId });
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setMoving(false);
    }
  };

  const subject = mode === 'item'
    ? `${itemIds.length} ${itemIds.length === 1 ? 'item' : 'items'}`
    : 'container';

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md animate-rise max-h-[90vh] overflow-y-auto mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow mb-1">Relocate</p>
        <h3 className="font-display text-xl font-semibold text-surface-100 mb-4">Move {subject}</h3>

        {error && (
          <div className="card border-red-900 bg-red-950/30 mb-4 py-2.5 px-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-surface-800 border-t-primary-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[0.7rem] uppercase tracking-wider text-surface-400 mb-1.5">
                Destination room
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setTargetRoomId(room.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                      targetRoomId === room.id
                        ? 'bg-surface-800 text-primary-400 ring-1 ring-primary-500/50'
                        : 'text-surface-300 hover:bg-surface-800'
                    }`}
                  >
                    <svg className="w-4 h-4 flex-shrink-0 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-sm truncate">{room.name}</span>
                    {room.id === parseInt(sourceRoomId) && (
                      <span className="font-mono text-[0.6rem] text-surface-500 ml-auto">current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'item' && targetRoomId != null && containers.length > 0 && (
              <div>
                <label className="block font-mono text-[0.7rem] uppercase tracking-wider text-surface-400 mb-1.5">
                  Into container (optional)
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <button
                    onClick={() => setTargetContainerId(null)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                      targetContainerId === null
                        ? 'bg-surface-800 text-primary-400 ring-1 ring-primary-500/50'
                        : 'text-surface-300 hover:bg-surface-800'
                    }`}
                  >
                    <span className="text-sm">Loose in this room</span>
                  </button>
                  {containers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setTargetContainerId(c.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                        targetContainerId === c.id
                          ? 'bg-surface-800 text-primary-400 ring-1 ring-primary-500/50'
                          : 'text-surface-300 hover:bg-surface-800'
                      }`}
                    >
                      <svg className="w-4 h-4 flex-shrink-0 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span className="text-sm truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'item' && targetRoomId != null && containers.length === 0 && (
              <p className="text-sm text-surface-500">
                No containers in this room — items will be filed loose.
              </p>
            )}

            {mode === 'container' && (
              <p className="text-sm text-surface-500">
                The container becomes a root in the destination room. Its contents move along with it.
              </p>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={handleConfirm}
                className="btn-primary"
                disabled={targetRoomId == null || moving}
              >
                {moving ? 'Moving…' : `Move ${subject}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
