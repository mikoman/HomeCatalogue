import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rooms as roomsApi, items as itemsApi, containers as containersApi, scan } from '../api/client';
import { compressImage } from '../utils/imageCompression';
import ItemCard from './ItemCard';
import ContainerTree from './ContainerTree';
import MovePicker from './MovePicker';

// Persist the active (in-flight / ready / failed) scans per room so the queue
// re-attaches after navigating away and back or a page refresh. The backend
// keeps each scan running regardless; this just lets the UI pick them back up.
const activeScansKey = (roomId) => `homeCatalogue:activeScans:${roomId}`;
const readActiveScans = (roomId) => {
  try {
    return JSON.parse(localStorage.getItem(activeScansKey(roomId)) || '[]');
  } catch {
    return [];
  }
};
const writeActiveScans = (roomId, sessionIds) =>
  localStorage.setItem(activeScansKey(roomId), JSON.stringify(sessionIds));

const POLL_INTERVAL_MS = 3000;

// A single scan in the queue. Multiple can exist at once — each is independent.
// status: 'pending' | 'processing' | 'completed' | 'failed'
function Thumb({ url }) {
  return url ? (
    <img src={url} alt="Scan" className="w-12 h-12 rounded object-cover flex-shrink-0 border border-surface-800" />
  ) : (
    <div className="w-12 h-12 rounded bg-surface-800 flex-shrink-0 grid place-items-center">
      <svg className="w-5 h-5 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  );
}

export default function RoomView() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const timersRef = useRef(new Map());   // per-session poll timers: sessionId -> timeoutId
  const mountedRef = useRef(false);       // skip the first (empty) persistence write

  const [room, setRoom] = useState(null);
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState([]);          // Scan[] queue
  const [scanError, setScanError] = useState(null); // upload-time error (couldn't even enqueue)
  const [reviewingScanId, setReviewingScanId] = useState(null);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());  // multi-select for item moves
  const [movingItems, setMovingItems] = useState(null);               // number[] when item-move picker is open

  // Derived queue buckets
  const inFlight = scans.filter(s => s.status === 'pending' || s.status === 'processing');
  const ready = scans.filter(s => s.status === 'completed');
  const failed = scans.filter(s => s.status === 'failed');
  const reviewingScan = scans.find(s => s.sessionId === reviewingScanId) || null;

  // ---- per-session polling (recursive setTimeout so timers never overlap) ----
  const clearTimer = useCallback((sessionId) => {
    const t = timersRef.current.get(sessionId);
    if (t) clearTimeout(t);
    timersRef.current.delete(sessionId);
  }, []);

  const startPolling = useCallback((sessionId) => {
    const poll = async () => {
      try {
        const data = await scan.getStatus(sessionId);
        setScans(prev => prev.map(s => s.sessionId === sessionId ? {
          ...s,
          status: data.status,
          // Keep the local blob preview if we have it; fall back to the
          // backend-served image (re-attaches the thumbnail after a refresh).
          imageUrl: s.imageUrl || data.image_url,
          result: data.result,
          error: data.error,
        } : s));
        if (data.status === 'completed' || data.status === 'failed') {
          clearTimer(sessionId); // terminal — stop polling this scan
        } else {
          timersRef.current.set(sessionId, setTimeout(poll, POLL_INTERVAL_MS));
        }
      } catch (err) {
        setScans(prev => prev.map(s => s.sessionId === sessionId
          ? { ...s, status: 'failed', error: err.message }
          : s));
        clearTimer(sessionId);
      }
    };
    poll();
  }, [clearTimer]);

  // Remove a scan from the queue (after review/discard/dismiss) and revoke its
  // local blob preview if it had one.
  const removeScan = useCallback((sessionId) => {
    setScans(prev => {
      const s = prev.find(x => x.sessionId === sessionId);
      if (s?.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(s.imageUrl);
      return prev.filter(x => x.sessionId !== sessionId);
    });
    clearTimer(sessionId);
  }, [clearTimer]);

  // ---- mount / room switch: load room data + re-attach persisted scans ----
  useEffect(() => {
    setLoading(true);
    loadData();
    const stored = readActiveScans(roomId);
    if (stored.length) {
      setScans(stored.map(id => ({
        sessionId: id, status: 'pending', imageUrl: null,
        result: null, error: null, startedAt: Date.now(),
      })));
      stored.forEach(id => startPolling(id));
    } else {
      setScans([]);
    }
    return () => {
      // Clear every poll timer on unmount / room switch so they don't leak.
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Persist the active scan ids whenever the queue changes (so a refresh or
  // navigation re-attaches). Skipped on the very first run to avoid wiping
  // stored ids before the re-attach effect above has committed them.
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    writeActiveScans(roomId, scans.map(s => s.sessionId));
  }, [scans, roomId]);

  const loadData = async () => {
    try {
      const [roomData, itemsData, containersData] = await Promise.all([
        roomsApi.get(roomId),
        itemsApi.list({ room_id: roomId }),
        containersApi.list(roomId),
      ]);
      setRoom(roomData);
      setItems(itemsData);
      setContainers(containersData);
    } catch (err) {
      console.error('Failed to load room:', err);
    } finally {
      setLoading(false);
    }
  };

  // Take a photo and enqueue a scan. The button is never disabled, so you can
  // fire off several photos in a row — each becomes its own background scan.
  const handleScan = async (file) => {
    setScanError(null);
    try {
      const compressed = await compressImage(file, { maxWidth: 1280, quality: 0.7 });
      const previewUrl = URL.createObjectURL(compressed);
      // Upload returns immediately with a session id; inference runs on the
      // backend. This is what keeps long Ollama runs from ever blocking the UI.
      const { scan_session_id } = await scan.upload(roomId, compressed);
      setScans(prev => [...prev, {
        sessionId: scan_session_id,
        status: 'pending',
        imageUrl: previewUrl,
        result: null,
        error: null,
        startedAt: Date.now(),
      }]);
      startPolling(scan_session_id);
    } catch (err) {
      setScanError(err.message);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleScan(file);
    }
    // Reset so the same file (or camera) can be picked again for the next photo.
    e.target.value = null;
  };

  // ---- multi-select item moves ----
  const toggleSelectItem = (id) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleMoveSelectedItems = () => {
    if (selectedItemIds.size === 0) return;
    setMovingItems([...selectedItemIds]);
  };

  const handleMoveSingleItem = (id) => {
    setMovingItems([id]);
  };

  // ---- review overlay (operates on the selected scan, not a single global result) ----
  const handleAcceptAll = async () => {
    if (!reviewingScan?.result) return;
    const result = reviewingScan.result;
    const existingContainers = reviewingScan.existingContainers || [];
    const itemTargets = reviewingScan.itemTargets || [];
    try {
      // 1. Build nameToId from existing containers (case-insensitive).
      const nameToId = {};
      existingContainers.forEach(c => { nameToId[c.name.toLowerCase()] = c.id; });

      // 2. Create only the proposed containers that don't already exist.
      for (const container of result.proposed_containers) {
        if (nameToId[container.name.toLowerCase()] != null) continue;
        const c = await containersApi.create({
          room_id: parseInt(roomId),
          name: container.name,
          description: container.description,
        });
        nameToId[container.name.toLowerCase()] = c.id;
      }

      // 3. Resolve each item's container_id from its (possibly overridden) target.
      const itemsToCreate = result.items.map((item, i) => {
        const target = itemTargets[i] || { kind: 'loose' };
        let container_id = null;
        if (target.kind === 'existing') {
          container_id = target.containerId;
        } else if (target.kind === 'proposed') {
          container_id = nameToId[target.name.toLowerCase()] || null;
        }
        return {
          room_id: parseInt(roomId),
          name: item.name,
          category: item.category,
          tags: item.tags,
          container_id,
          confidence_score: item.confidence_score,
          scan_session_id: null,
        };
      });

      // 4. Bulk-create items, then refresh and close the review.
      await itemsApi.bulkCreate({ items: itemsToCreate });
      await loadData();
      const id = reviewingScanId;
      setReviewingScanId(null);
      removeScan(id);
    } catch (err) {
      console.error('Failed to accept scan results:', err);
    }
  };

  const handleRejectItem = (index) => {
    if (!reviewingScan?.result) return;
    setScans(prev => prev.map(s => {
      if (s.sessionId !== reviewingScanId) return s;
      const next = {
        ...s,
        result: { ...s.result, items: s.result.items.filter((_, i) => i !== index) },
      };
      if (s.itemTargets) {
        next.itemTargets = s.itemTargets.filter((_, i) => i !== index);
      }
      return next;
    }));
  };

  const handleEditItem = (index, field, value) => {
    if (!reviewingScan?.result) return;
    setScans(prev => prev.map(s => s.sessionId === reviewingScanId ? {
      ...s,
      result: {
        ...s.result,
        items: s.result.items.map((it, i) => i === index ? { ...it, [field]: value } : it),
      },
    } : s));
  };

  // When a scan's review overlay opens, fetch the room's existing containers
  // and seed a per-item destination (existing | proposed | loose) from the AI's
  // suggested_container. The user can override each one before accepting.
  useEffect(() => {
    if (reviewingScanId == null) return;
    const scan = scans.find(s => s.sessionId === reviewingScanId);
    if (!scan || !scan.result) return;
    if (scan.existingContainers) return;  // already initialized

    let cancelled = false;
    (async () => {
      try {
        const existing = await containersApi.list(parseInt(roomId), null, { includeAll: true });
        if (cancelled) return;
        const nameToId = {};
        existing.forEach(c => { nameToId[c.name.toLowerCase()] = c.id; });
        const proposedNames = (scan.result.proposed_containers || []).map(c => c.name.toLowerCase());
        const itemTargets = scan.result.items.map(item => {
          const sc = item.suggested_container;
          if (sc && nameToId[sc.toLowerCase()] != null) {
            return { kind: 'existing', containerId: nameToId[sc.toLowerCase()] };
          }
          if (sc && proposedNames.includes(sc.toLowerCase())) {
            return { kind: 'proposed', name: sc };
          }
          return { kind: 'loose' };
        });
        setScans(prev => prev.map(s => s.sessionId === reviewingScanId
          ? { ...s, existingContainers: existing, itemTargets }
          : s));
      } catch (err) {
        console.error('Failed to load existing containers for review:', err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewingScanId, roomId]);

  const handleItemTargetChange = (index, value) => {
    setScans(prev => prev.map(s => {
      if (s.sessionId !== reviewingScanId || !s.itemTargets) return s;
      const itemTargets = [...s.itemTargets];
      if (value === 'loose') {
        itemTargets[index] = { kind: 'loose' };
      } else if (value.startsWith('existing:')) {
        itemTargets[index] = { kind: 'existing', containerId: parseInt(value.split(':')[1]) };
      } else if (value.startsWith('proposed:')) {
        itemTargets[index] = { kind: 'proposed', name: value.slice('proposed:'.length) };
      }
      return { ...s, itemTargets };
    }));
  };

  const filteredItems = selectedContainer
    ? items.filter(item => item.container_id === selectedContainer)
    : filterCategory
      ? items.filter(item => item.category === filterCategory)
      : items;

  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
  const chipBase = 'font-mono text-[0.62rem] uppercase tracking-wider px-2.5 py-1 rounded-sm border transition-colors whitespace-nowrap';
  const chipOn = 'bg-primary-500 text-surface-950 border-primary-500';
  const chipOff = 'bg-surface-900 text-surface-400 border-surface-700 hover:border-surface-600';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-surface-800 border-t-primary-500"></div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="card border-red-900 bg-red-950/30">
        <p className="text-red-400">Room not found.</p>
        <button onClick={() => navigate('/houses')} className="btn-secondary mt-3">Back to index</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-rise min-w-0 max-w-full">
      {/* Room header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="font-mono text-[0.7rem] uppercase tracking-wider text-surface-500 hover:text-primary-400 mb-2 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="font-display text-3xl font-bold tracking-tight text-surface-100 truncate">{room.name}</h2>
          {room.description && (
            <p className="text-surface-400 mt-1">{room.description}</p>
          )}
          <p className="mt-2 font-mono text-[0.7rem] text-surface-500 tracking-wider">
            {items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}
            <span className="text-surface-700"> · </span>
            {containers.length} {containers.length === 1 ? 'CONTAINER' : 'CONTAINERS'}
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary self-start sm:self-auto relative"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Scan area
          {inFlight.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-surface-950/40 text-[0.65rem] font-mono font-bold text-primary-300">
              {inFlight.length}
            </span>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Scan queue — multiple photos can be processing at once; each is
          independent and reviewable on its own. */}
      {scans.length > 0 && (
        <div className="space-y-3">
          {/* In-flight scans */}
          {inFlight.length > 0 && (
            <div className="rounded-lg overflow-hidden border border-primary-500/40">
              <div className="scan-stripes h-2.5" />
              <div className="bg-surface-900 divide-y divide-surface-800">
                {inFlight.map(s => (
                  <div key={s.sessionId} className="px-4 py-3 flex items-center gap-3">
                    <Thumb url={s.imageUrl} />
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-surface-700 border-t-primary-500 flex-shrink-0"></div>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-surface-100">Reading the photo…</p>
                      <p className="eyebrow mt-0.5">AI is identifying and tagging items</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ready to review */}
          {ready.length > 0 && (
            <div className="space-y-2">
              <p className="eyebrow">Ready to review · {ready.length}</p>
              {ready.map(s => (
                <div key={s.sessionId} className="card flex flex-wrap items-center gap-3 py-3">
                  <Thumb url={s.imageUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-surface-100 font-medium">
                      {s.result?.items.length || 0} {s.result?.items.length === 1 ? 'item' : 'items'} found
                    </p>
                    <p className="text-xs text-surface-500">
                      {s.result?.proposed_containers.length || 0} {s.result?.proposed_containers.length === 1 ? 'container' : 'containers'}
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => setReviewingScanId(s.sessionId)} className="btn-primary flex-1 sm:flex-none">Review</button>
                    <button onClick={() => removeScan(s.sessionId)} className="btn-secondary flex-1 sm:flex-none">Discard</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Failed scans */}
          {failed.length > 0 && (
            <div className="space-y-2">
              {failed.map(s => (
                <div key={s.sessionId} className="card border-red-900 bg-red-950/30 flex flex-wrap items-center gap-3 py-3">
                  <Thumb url={s.imageUrl} />
                  <p className="text-red-400 text-sm flex-1 min-w-0">Couldn't scan that photo. {s.error}</p>
                  <button onClick={() => removeScan(s.sessionId)} className="btn-secondary w-full sm:w-auto">Dismiss</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {scanError && (
        <div className="card border-red-900 bg-red-950/30">
          <p className="text-red-400 text-sm">Couldn't start that scan. {scanError}</p>
        </div>
      )}

      {/* Scan result overlay — bound to the selected scan, not a single global result */}
      {reviewingScan && (
        <div className="fixed inset-0 bg-surface-950/95 backdrop-blur-sm z-50 overflow-y-auto safe-top safe-bottom">
          <div className="hazard h-1 w-full sticky top-0" />
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="eyebrow">Review scan</p>
                <h3 className="font-display text-2xl font-bold text-surface-100">Confirm the catalogue</h3>
              </div>
              <button
                onClick={() => setReviewingScanId(null)}
                className="p-2 -mr-2 text-surface-500 hover:text-surface-200 transition-colors"
                aria-label="Close review"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Source image */}
            {reviewingScan.imageUrl && (
              <div className="mb-6">
                <p className="eyebrow mb-2">Source</p>
                <div className="rounded-lg overflow-hidden border border-surface-800">
                  <img src={reviewingScan.imageUrl} alt="Scanned area" className="w-full h-auto" />
                </div>
              </div>
            )}

            {/* New containers to be created (existing ones are filed via the per-item selector) */}
            {reviewingScan.result?.proposed_containers.length > 0 && (
              <div className="mb-6">
                <p className="eyebrow mb-2">New containers · {reviewingScan.result.proposed_containers.length}</p>
                <div className="space-y-2">
                  {reviewingScan.result.proposed_containers.map((container, i) => (
                    <div key={i} className="card flex items-center gap-3 py-3">
                      <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <div>
                        <p className="text-surface-100 font-medium">{container.name}</p>
                        {container.description && (
                          <p className="text-xs text-surface-500">{container.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items to review */}
            <div className="mb-6">
              <p className="eyebrow mb-2">Discovered items · {reviewingScan.result?.items.length || 0}</p>
              <div className="space-y-2">
                {reviewingScan.result?.items.map((item, i) => (
                  <div key={i} className="card py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.62rem] text-surface-600 w-7 flex-shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleEditItem(i, 'name', e.target.value)}
                        className="input-field text-sm py-1.5 flex-1"
                      />
                      <button
                        onClick={() => handleRejectItem(i)}
                        className="p-1.5 text-surface-500 hover:text-red-400 transition-colors flex-shrink-0"
                        aria-label="Remove item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-9">
                      {item.category && <span className="tag">{item.category}</span>}
                      {item.suggested_container && (
                        <span className="tag bg-primary-900/40 text-primary-400 border-primary-900">→ {item.suggested_container}</span>
                      )}
                      {item.confidence_score < 0.8 && (
                        <span className="badge-low">Low confidence</span>
                      )}
                    </div>
                    {/* Per-item destination selector — reuse existing containers
                        before creating new ones. Defaults from the AI's
                        suggested_container; user can override each. */}
                    {reviewingScan.existingContainers && (() => {
                      const target = reviewingScan.itemTargets?.[i] || { kind: 'loose' };
                      let selectValue = 'loose';
                      if (target.kind === 'existing') selectValue = `existing:${target.containerId}`;
                      else if (target.kind === 'proposed') selectValue = `proposed:${target.name}`;
                      return (
                        <div className="flex items-center gap-2 mt-2 pl-9">
                          <span className="font-mono text-[0.62rem] uppercase tracking-wider text-surface-500">File in</span>
                          <select
                            value={selectValue}
                            onChange={(e) => handleItemTargetChange(i, e.target.value)}
                            className="input-field text-sm py-1 flex-1 min-w-0"
                          >
                            <option value="loose">Loose in room</option>
                            {reviewingScan.existingContainers.length > 0 && (
                              <optgroup label="Existing">
                                {reviewingScan.existingContainers.map(c => (
                                  <option key={c.id} value={`existing:${c.id}`}>{c.name}</option>
                                ))}
                              </optgroup>
                            )}
                            {(reviewingScan.result?.proposed_containers || []).length > 0 && (
                              <optgroup label="New containers">
                                {reviewingScan.result.proposed_containers.map(c => (
                                  <option key={c.name} value={`proposed:${c.name}`}>{c.name} (new)</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 sticky bottom-0 bg-surface-950/95 backdrop-blur-sm pt-4 pb-6 safe-bottom">
              <button
                onClick={() => { removeScan(reviewingScanId); setReviewingScanId(null); }}
                className="btn-secondary flex-1"
              >
                Discard
              </button>
              <button
                onClick={handleAcceptAll}
                className="btn-primary flex-1"
                disabled={(reviewingScan.result?.items.length || 0) === 0}
              >
                File {reviewingScan.result?.items.length || 0} {(reviewingScan.result?.items.length || 0) === 1 ? 'item' : 'items'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {(containers.length > 0 || categories.length > 0) && (
        <div className="min-w-0 max-w-full overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <div className="flex gap-2 w-max max-w-none">
          <button
            onClick={() => { setSelectedContainer(null); setFilterCategory(null); }}
            className={`${chipBase} ${!selectedContainer && !filterCategory ? chipOn : chipOff}`}
          >
            All · {items.length}
          </button>
          {containers.map(container => (
            <button
              key={container.id}
              onClick={() => { setFilterCategory(null); setSelectedContainer(selectedContainer === container.id ? null : container.id); }}
              className={`${chipBase} ${selectedContainer === container.id ? chipOn : chipOff}`}
            >
              {container.name}
            </button>
          ))}
          {categories.map(category => (
            <button
              key={category}
              onClick={() => { setSelectedContainer(null); setFilterCategory(filterCategory === category ? null : category); }}
              className={`${chipBase} ${filterCategory === category ? chipOn : chipOff}`}
            >
              {category}
            </button>
          ))}
          </div>
        </div>
      )}

      {/* Container tree */}
      {containers.length > 0 && (
        <div className="card min-w-0 overflow-hidden">
          <p className="eyebrow mb-2">Containers</p>
          <ContainerTree
            containers={containers}
            roomId={roomId}
            selectedId={selectedContainer}
            onSelect={(id) => { setFilterCategory(null); setSelectedContainer(selectedContainer === id ? null : id); }}
            onMoved={loadData}
          />
        </div>
      )}

      {/* Items grid */}
      {filteredItems.length === 0 ? (
        <div className="card text-center py-14">
          <div className="w-14 h-14 rounded-lg bg-surface-800 grid place-items-center mx-auto mb-4">
            <svg className="w-7 h-7 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-surface-200 mb-1">
            {items.length === 0 ? 'Nothing catalogued yet' : 'No items match this filter'}
          </h3>
          <p className="text-surface-500 mb-5">
            {items.length === 0 ? 'Point your camera at a shelf and let the AI do the filing.' : 'Try a different container or category.'}
          </p>
          {items.length === 0 && (
            <button onClick={() => fileInputRef.current?.click()} className="btn-primary mx-auto">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Scan area
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 min-w-0 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                selected={selectedItemIds.has(item.id)}
                onToggleSelect={toggleSelectItem}
                onMove={handleMoveSingleItem}
                onUpdate={(updates) => itemsApi.update(item.id, updates).then(loadData)}
                onDelete={() => itemsApi.delete(item.id).then(loadData)}
              />
            ))}
          </div>

          {/* Multi-select action bar */}
          {selectedItemIds.size > 0 && (
            <div className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface-950/90 backdrop-blur-sm border-t border-surface-800 flex items-center justify-between gap-3 safe-bottom">
              <span className="text-sm text-surface-300">
                {selectedItemIds.size} {selectedItemIds.size === 1 ? 'item' : 'items'} selected
              </span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedItemIds(new Set())} className="btn-secondary text-sm">Clear</button>
                <button onClick={handleMoveSelectedItems} className="btn-primary text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m0 0l-3-3m3 3l-3 3" />
                  </svg>
                  Move {selectedItemIds.size} {selectedItemIds.size === 1 ? 'item' : 'items'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Item-move picker (multi-select or single) */}
      {movingItems && (
        <MovePicker
          sourceRoomId={parseInt(roomId)}
          mode="item"
          itemIds={movingItems}
          onDone={() => { setSelectedItemIds(new Set()); loadData(); }}
          onClose={() => setMovingItems(null)}
        />
      )}
    </div>
  );
}
