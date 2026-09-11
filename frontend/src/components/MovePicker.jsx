import { useState, useEffect, useMemo, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { rooms as roomsApi, containers as containersApi, items as itemsApi } from '../api/client';

function containerPaths(containers) {
  const byId = new Map(containers.map(container => [container.id, container]));
  return containers.map(container => {
    const names = [];
    const seen = new Set();
    let current = container;
    while (current && !seen.has(current.id)) {
      names.unshift(current.name);
      seen.add(current.id);
      current = byId.get(current.parent_id);
    }
    return { id: container.id, name: names.join(' / ') };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export default function MovePicker({ sourceRoomId, mode, itemIds, containerId, onDone, onClose }) {
  const [rooms, setRooms] = useState([]);
  const [targetRoomId, setTargetRoomId] = useState(null);
  const [containers, setContainers] = useState([]);
  const [targetContainerId, setTargetContainerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [containersLoading, setContainersLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [containerError, setContainerError] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [containerRetry, setContainerRetry] = useState(0);
  const dialogRef = useRef(null);
  const movingRef = useRef(false);
  const fieldId = useId();
  const paths = useMemo(() => containerPaths(containers), [containers]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setError(null);
    setRooms([]);
    setTargetRoomId(null);
    setTargetContainerId(null);
    setContainers([]);
    (async () => {
      try {
        const source = await roomsApi.get(sourceRoomId);
        if (cancelled) return;
        const roomList = await roomsApi.list(source.house_id);
        if (cancelled) return;
        setRooms(roomList);
        setContainersLoading(mode === 'item');
        setTargetRoomId(source.id);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'The rooms could not load. Try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sourceRoomId, retry]);

  useEffect(() => {
    let cancelled = false;
    setTargetContainerId(null);
    setContainers([]);
    setContainerError(null);
    if (mode !== 'item' || targetRoomId == null) {
      setContainersLoading(false);
      return;
    }
    setContainersLoading(true);
    containersApi.list(targetRoomId, null, { includeAll: true })
      .then(list => { if (!cancelled) setContainers(list); })
      .catch(err => { if (!cancelled) setContainerError(err.message || 'The containers could not load. Try again.'); })
      .finally(() => { if (!cancelled) setContainersLoading(false); });
    return () => { cancelled = true; };
  }, [mode, targetRoomId, containerRetry]);

  const canMove = targetRoomId != null && !loading && !containersLoading && !loadError && !containerError && !moving;
  const close = () => { if (!movingRef.current) onClose(); };

  const handleConfirm = async (event) => {
    event.preventDefault();
    if (!canMove || movingRef.current) return;
    if (!rooms.some(room => room.id === targetRoomId)) return;
    if (mode === 'item' && targetContainerId != null && !containers.some(container => container.id === targetContainerId)) return;
    movingRef.current = true;
    setMoving(true);
    setError(null);
    try {
      if (mode === 'item') {
        await itemsApi.move({ itemIds, roomId: targetRoomId, containerId: targetContainerId });
      } else {
        await containersApi.move(containerId, { roomId: targetRoomId });
      }
      onDone?.();
      onClose();
    } catch (err) {
      setError(err.message || 'The move did not save. Try again.');
    } finally {
      movingRef.current = false;
      setMoving(false);
    }
  };

  const subject = mode === 'item'
    ? `${itemIds.length} ${itemIds.length === 1 ? 'item' : 'items'}`
    : 'container';

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={`${fieldId}-title`}
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}
      className="w-[calc(100%-2rem)] max-w-md max-h-[90dvh] m-auto p-0 rounded-xl bg-surface-900 text-surface-300 border border-surface-700 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleConfirm} className="p-5 space-y-5">
        <h2 id={`${fieldId}-title`} className="font-display text-xl font-semibold text-surface-100">Move {subject}</h2>
        {loading ? (
          <p role="status" className="text-surface-400 py-4">Loading rooms…</p>
        ) : loadError ? (
          <div className="space-y-3" role="alert">
            <p className="text-sm text-red-400">{loadError}</p>
            <button type="button" onClick={() => setRetry(value => value + 1)} className="btn-secondary min-h-11">Try again</button>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor={`${fieldId}-room`} className="block text-sm text-surface-300 mb-2">Destination room</label>
              <select
                id={`${fieldId}-room`}
                value={targetRoomId ?? ''}
                disabled={moving}
                onChange={event => {
                  setTargetRoomId(Number(event.target.value));
                  setTargetContainerId(null);
                  setContainers([]);
                  setContainersLoading(mode === 'item');
                  setContainerError(null);
                  setError(null);
                }}
                className="input-field text-base min-h-11"
              >
                {!rooms.length && <option value="">No rooms available</option>}
                {rooms.map(room => <option key={room.id} value={room.id}>{room.name}{room.id === Number(sourceRoomId) ? ' (current room)' : ''}</option>)}
              </select>
            </div>
            {mode === 'item' && targetRoomId != null && (
              <div>
                <label htmlFor={`${fieldId}-container`} className="block text-sm text-surface-300 mb-2">Container</label>
                {containersLoading ? <p role="status" className="text-sm text-surface-400">Loading containers…</p> : containerError ? (
                  <div role="alert" className="space-y-3">
                    <p className="text-sm text-red-400">{containerError}</p>
                    <button type="button" onClick={() => setContainerRetry(value => value + 1)} className="btn-secondary min-h-11">Try again</button>
                  </div>
                ) : (
                  <select id={`${fieldId}-container`} value={targetContainerId ?? ''} disabled={moving} onChange={event => { setTargetContainerId(event.target.value ? Number(event.target.value) : null); setError(null); }} className="input-field text-base min-h-11">
                    <option value="">Loose in this room</option>
                    {paths.map(container => <option key={container.id} value={container.id}>{container.name}</option>)}
                  </select>
                )}
              </div>
            )}
            {mode === 'container' && <p className="text-sm text-surface-400">The container and its contents move to the room. It will have no parent container.</p>}
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          </>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <button type="button" onClick={close} disabled={moving} className="btn-secondary min-h-11">Cancel</button>
          <button type="submit" disabled={!canMove} className="btn-primary flex-1 min-h-11">{moving ? 'Moving…' : `Move ${subject}`}</button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
