import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { rooms as roomsApi, items as itemsApi, containers as containersApi, scan } from '../api/client';
import useScanQueue from '../hooks/useScanQueue';
import { buildScanAcceptance, reconcileReview, selectedReviewCount as countReviewSelection, containerLocationLabel } from '../utils/scanReview';
import ItemCard from './ItemCard';
import ItemDetailLightbox from './ItemDetailLightbox';
import ContainerTree from './ContainerTree';
import MovePicker from './MovePicker';
import { groupItemsByName } from '../utils/groupItems';


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
  return <RoomContent key={roomId} roomId={roomId} />;
}

function RoomContent({ roomId }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const libraryInputRef = useRef(null);
  const captureTargetRef = useRef(null);
  const reviewDialogRef = useRef(null);
  const reviewContentRef = useRef(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(false);

  const [room, setRoom] = useState(null);
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { scans, setScans, error: scanError, relocated, addFiles, retryScan, removeScan, refreshScan, getScan } = useScanQueue(roomId);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState(null);
  const addingItemRef = useRef(false);
  const newItemInputRef = useRef(null);
  const [reviewingScanId, setReviewingScanId] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);  // item index whose box is highlighted
  const [selectedContainer, setSelectedContainer] = useState(() => Number(searchParams.get('container')) || null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());  // multi-select for item moves
  const [movingItems, setMovingItems] = useState(null);               // number[] when item-move picker is open
  const [selectMode, setSelectMode] = useState(false);                // opt-in selection mode
  const [detailGroup, setDetailGroup] = useState(null);               // grouped item open in the detail lightbox


  const inFlight = scans.filter(entry => ['waiting', 'preparing', 'uploading', 'pending', 'processing'].includes(entry.status));
  const ready = scans.filter(entry => entry.status === 'completed');
  const failed = scans.filter(entry => ['failed', 'upload_failed'].includes(entry.status));
  const reviewingScan = scans.find(entry => entry.sessionId === reviewingScanId) || null;
  const reviewIsVisible = Boolean(reviewingScan && room && !loading);
  const selectedReviewCount = countReviewSelection(reviewingScan);
  const uploadsPending = scans.some(entry => ['waiting', 'preparing', 'uploading'].includes(entry.status));

  const loadData = useCallback(async () => {
    try {
      const [roomData, itemsData, containersData] = await Promise.all([
        roomsApi.get(roomId), itemsApi.list({ room_id: roomId }),
        containersApi.list(roomId, null, { includeAll: true }),
      ]);
      if (!mountedRef.current) return;
      setRoom(roomData);
      setItems(itemsData);
      setContainers(containersData);
      setLoadError(null);
      try { localStorage.setItem('homeCatalogue:lastRoom', String(roomId)); } catch { /* Storage is optional. */ }
    } catch (err) {
      if (mountedRef.current) setLoadError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  useEffect(() => {
    const sessionId = searchParams.get('review');
    if (sessionId && scans.some(entry => entry.sessionId === sessionId && entry.status === 'completed')) {
      setReviewingScanId(sessionId);
      const next = new URLSearchParams(searchParams);
      next.delete('review');
      setSearchParams(next, { replace: true });
    }
    const itemId = Number(searchParams.get('item'));
    if (itemId && items.length) {
      const item = items.find(entry => entry.id === itemId);
      if (item) setDetailGroup({ name: item.name, items: [item], count: 1 });
      const next = new URLSearchParams(searchParams);
      next.delete('item');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, scans, items]);

  useEffect(() => {
    if (!reviewIsVisible) return;
    setSaveError(null);
    setHoveredItem(null);
    reviewDialogRef.current?.showModal();
    if (reviewContentRef.current) reviewContentRef.current.scrollTop = 0;
  }, [reviewingScanId, reviewIsVisible]);

  const openCapture = (source, containerId = selectedContainer) => {
    captureTargetRef.current = containerId;
    (source === 'library' ? libraryInputRef : fileInputRef).current?.click();
  };

  const openContainerScan = (containerId) => openCapture('camera', containerId);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const target = captureTargetRef.current;
    captureTargetRef.current = null;
    addFiles(files, target, containers.find(container => container.id === target)?.name || null);
  };

  const handleRescan = async (sessionId) => {
    setReviewingScanId(null);
    await retryScan(sessionId);
  };

  useEffect(() => {
    if (showAddItem) newItemInputRef.current?.focus();
  }, [showAddItem]);

  const handleAddItem = async (event) => {
    event.preventDefault();
    if (!newItemName.trim() || addingItemRef.current) return;
    addingItemRef.current = true;
    setAddingItem(true);
    setAddItemError(null);
    try {
      const item = await itemsApi.create({ room_id: Number(roomId), container_id: selectedContainer, name: newItemName.trim(), category: newItemCategory.trim() || null });
      setItems(previous => [...previous, item]);
      setNotice(`${item.name} saved to ${selectedContainerRecord?.name || room.name}.`);
      setNewItemName('');
      setNewItemCategory('');
      setItemSearch('');
      setFilterCategory(null);
      newItemInputRef.current?.focus();
    } catch (err) {
      setAddItemError(err.message);
    } finally {
      addingItemRef.current = false;
      setAddingItem(false);
    }
  };

  // ---- multi-select item moves ----
  const handleMoveSelectedItems = () => {
    if (selectedItemIds.size === 0) return;
    setMovingItems([...selectedItemIds]);
  };

  const handleMoveSingleItem = (ids) => {
    setMovingItems(Array.isArray(ids) ? ids : [ids]);
  };

  const toggleSelectGroup = (groupItems) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      const allSelected = groupItems.every(i => next.has(i.id));
      for (const i of groupItems) {
        if (allSelected) next.delete(i.id);
        else next.add(i.id);
      }
      return next;
    });
  };

  const toggleSelectMode = () => {
    setSelectMode(prev => {
      const next = !prev;
      if (!next) setSelectedItemIds(new Set());
      return next;
    });
  };

  const selectAllVisible = () => {
    const all = new Set();
    for (const it of filteredItems) all.add(it.id);
    setSelectedItemIds(all);
  };

  const handleAcceptAll = async () => {
    if (!reviewingScan?.existingContainers || savingRef.current || !selectedReviewCount) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const status = await refreshScan(reviewingScanId);
      if (Number(status.room_id) !== Number(roomId)) {
        setReviewingScanId(null);
        return;
      }
      if (status.status === 'filed') {
        setNotice('This photo was already saved.');
        setReviewingScanId(null);
        await loadData();
        return;
      }
      if (status.status !== 'completed' || status.result_revision !== reviewingScan.resultRevision) {
        setSaveError('This photo changed after another analysis. Review the current result before saving.');
        return;
      }
      const currentContainers = await containersApi.list(roomId, null, { includeAll: true });
      const currentReview = reconcileReview(getScan(reviewingScanId), currentContainers, items);
      setContainers(currentContainers);
      setScans(previous => previous.map(entry => entry.sessionId === reviewingScanId ? currentReview : entry));
      const payload = { ...buildScanAcceptance(currentReview), room_id: Number(roomId), expected_revision: status.result_revision };
      const receipt = await scan.accept(reviewingScanId, payload);
      const nextReady = ready.find(entry => entry.sessionId !== reviewingScanId);
      await removeScan(reviewingScanId, { dismiss: false });
      const savedCounts = [
        receipt.item_ids.length ? `${receipt.item_ids.length} ${receipt.item_ids.length === 1 ? 'item' : 'items'}` : null,
        receipt.container_ids.length ? `${receipt.container_ids.length} ${receipt.container_ids.length === 1 ? 'container' : 'containers'}` : null,
      ].filter(Boolean).join(' and ');
      setNotice(`${savedCounts} saved to ${room.name}.`);
      await loadData();
      setReviewingScanId(nextReady?.sessionId || null);
    } catch (err) {
      setSaveError(err.message);
      if (err.status === 409) await refreshScan(reviewingScanId).catch(() => {});
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleItemSkipChange = (index, skip) => {
    setScans(prev => prev.map(s => {
      if (s.sessionId !== reviewingScanId || !s.itemSkip) return s;
      const itemSkip = [...s.itemSkip];
      itemSkip[index] = skip;
      return { ...s, itemSkip };
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

  useEffect(() => {
    if (!reviewingScanId || !room) return;
    setScans(previous => previous.map(entry => entry.sessionId === reviewingScanId && entry.result
      ? reconcileReview(entry, containers, items) : entry));
  }, [reviewingScanId, reviewingScan?.resultRevision, room, containers, items, setScans]);

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

  const handleProposedChange = (index, field, value) => {
    setScans(previous => previous.map(entry => {
      if (entry.sessionId !== reviewingScanId) return entry;
      if (field === 'skip') return { ...entry, proposedSkip: entry.proposedSkip.map((skip, i) => i === index ? value : skip) };
      if (field === 'target') return { ...entry, proposedTargets: entry.proposedTargets.map((target, i) => i === index ? value : target) };
      const oldName = entry.result.proposed_containers[index].name;
      return {
        ...entry,
        result: { ...entry.result, proposed_containers: entry.result.proposed_containers.map((container, i) => i === index ? { ...container, name: value } : container) },
        itemTargets: entry.itemTargets.map(target => target.kind === 'proposed' && target.name === oldName ? { ...target, name: value } : target),
      };
    }));
  };

  const handleContainerFlagChange = (index, isContainer) => {
    setScans(prev => prev.map(s => {
      if (s.sessionId !== reviewingScanId || !s.containerFlags) return s;
      const containerFlags = [...s.containerFlags];
      containerFlags[index] = isContainer;
      return { ...s, containerFlags };
    }));
  };

  const locationItems = selectedContainer
    ? items.filter(item => item.container_id === selectedContainer)
    : filterCategory
      ? items.filter(item => item.category === filterCategory)
      : items;

  const filteredItems = locationItems.filter(item => !itemSearch.trim() || `${item.name} ${item.category || ''} ${(item.tags || []).join(' ')}`.toLowerCase().includes(itemSearch.trim().toLowerCase()));

  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
  const selectedContainerRecord = selectedContainer
    ? containers.find(c => c.id === selectedContainer)
    : null;
  const isEmptyContainerView = selectedContainer && locationItems.length === 0;
  const chipBase = 'text-sm min-h-11 px-3 py-2 rounded-md border transition-colors whitespace-nowrap';
  const chipOn = 'bg-primary-500 text-surface-950 border-primary-500';
  const chipOff = 'bg-surface-900 text-surface-400 border-surface-700 hover:border-surface-600';

  if (loading) {
    return (
      <div className="space-y-4 py-6" role="status">
        <p className="text-surface-400">Loading room…</p>
        <div className="h-24 bg-surface-900 rounded-lg animate-pulse" />
        <div className="h-40 bg-surface-900 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="card border-red-900 bg-red-950/30">
        <p className="text-red-400" role="alert">{loadError || 'Room not found.'}</p>
        <button onClick={loadData} className="btn-primary mt-3">Try again</button>
        <button onClick={() => navigate('/houses')} className="btn-secondary mt-3">Back to index</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      {/* Room header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate(`/houses/${room.house_id}`)}
            className="font-mono text-[0.7rem] uppercase tracking-wider text-surface-500 hover:text-primary-400 mb-2 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            House
          </button>
          <h1 className="font-display text-3xl font-bold tracking-tight text-surface-100 break-words">{room.name}</h1>
          {room.description && (
            <p className="text-surface-400 mt-1">{room.description}</p>
          )}
          <p className="mt-2 font-mono text-[0.7rem] text-surface-500 tracking-wider">
            {items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}
            <span className="text-surface-700"> · </span>
            {containers.length} {containers.length === 1 ? 'CONTAINER' : 'CONTAINERS'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
        <button
          onClick={() => openCapture('camera')}
          className="btn-primary min-h-12 flex-1 sm:flex-none relative"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Take photo
          {inFlight.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-surface-950/40 text-[0.65rem] font-mono font-bold text-primary-300">
              {inFlight.length}
            </span>
          )}
        </button>
          <button onClick={() => openCapture('library')} className="btn-secondary min-h-12 flex-1 sm:flex-none">Choose photos</button>
          <button onClick={() => setShowAddItem(previous => !previous)} aria-expanded={showAddItem} aria-controls="add-item-form" className="btn-secondary min-h-12 flex-1 sm:flex-none">Add item</button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <input ref={libraryInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
      <p className="text-sm text-surface-400 !mt-3">
        {selectedContainerRecord ? `New photos go into ${containerLocationLabel(selectedContainerRecord, containers)}.` : 'Photograph a shelf, drawer, or group of items.'} Review the list before saving.
      </p>
      {notice && <p role="status" className="text-primary-400">{notice}</p>}
      {relocated.map(entry => <p key={entry.sessionId} role="status" className="text-surface-300">A scan moved with its container. <button className="underline text-primary-400" onClick={() => navigate(`/rooms/${entry.roomId}?review=${encodeURIComponent(entry.sessionId)}`)}>Open its current room</button></p>)}
      {loadError && <p role="alert" className="text-red-400">{loadError} <button className="underline" onClick={loadData}>Try again</button></p>}
      {uploadsPending && <p role="status" className="text-sm text-surface-300">Keep this browser tab open until your photos finish uploading. You can take another photo or open another room.</p>}

      {showAddItem && (
        <form id="add-item-form" onSubmit={handleAddItem} className="border-y border-surface-700 py-5 space-y-3">
          <h3 className="text-lg font-semibold text-surface-100">Add an item to {selectedContainerRecord?.name || room.name}</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1 text-sm text-surface-400">Item name
              <input disabled={addingItem} ref={newItemInputRef} value={newItemName} onChange={(event) => setNewItemName(event.target.value)} required maxLength={500} className="input-field mt-1 text-base" placeholder="For example, spare house keys" />
            </label>
            <label className="sm:w-52 text-sm text-surface-400">Category (optional)
              <input disabled={addingItem} value={newItemCategory} onChange={(event) => setNewItemCategory(event.target.value)} maxLength={255} className="input-field mt-1 text-base" placeholder="For example, tools" />
            </label>
          </div>
          {addItemError && <p role="alert" className="text-red-400">{addItemError}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={addingItem || !newItemName.trim()}>{addingItem ? 'Saving…' : 'Save item'}</button>
            <button type="button" className="btn-secondary" disabled={addingItem} onClick={() => setShowAddItem(false)}>Done</button>
          </div>
        </form>
      )}

      {/* Scan queue — multiple photos can be processing at once; each is
          independent and reviewable on its own. */}
      {scans.length > 0 && (
        <div className="space-y-3">
          {/* In-flight scans */}
          {inFlight.length > 0 && (
            <div className="rounded-lg overflow-hidden border border-primary-500/40">

              <div className="bg-surface-900 divide-y divide-surface-800">
                {inFlight.map(s => (
                  <div key={s.sessionId} className="px-4 py-3 flex items-center gap-3">
                    <Thumb url={s.imageUrl} />
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-surface-700 border-t-primary-500 flex-shrink-0"></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-100" role="status">{{ waiting: 'Waiting to upload', preparing: 'Preparing photo…', uploading: 'Uploading photo…', pending: 'Waiting for analysis…', processing: 'Finding items…' }[s.status]}</p>
                      <p className="text-sm text-surface-400 mt-0.5">{s.connectionError || s.containerName || 'Your photo will appear here when it is ready.'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ready to review */}
          {ready.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-surface-100" aria-live="polite">Ready to review · {ready.length}</h3>
              {ready.map(s => (
                <div key={s.sessionId} className="card flex flex-wrap items-center gap-3 py-3">
                  <Thumb url={s.imageUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-surface-100 font-medium">
                      {s.result?.items?.length || 0} {s.result?.items?.length === 1 ? 'item' : 'items'} found
                    </p>
                    <p className="text-xs text-surface-500">
                      {s.result?.proposed_containers?.length || 0} {s.result?.proposed_containers?.length === 1 ? 'container' : 'containers'}
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
                  <p className="text-red-400 text-sm flex-1 min-w-0">The photo needs another attempt. {s.error}</p>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => retryScan(s.sessionId)} className="btn-primary flex-1 sm:flex-none">Try again</button>
                    <button onClick={() => removeScan(s.sessionId)} className="btn-secondary flex-1 sm:flex-none">Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {scanError && (
        <div className="card border-red-900 bg-red-950/30">
          <p className="text-red-400 text-sm" role="alert">{scanError}</p>
        </div>
      )}

      {/* Scan result overlay — bound to the selected scan, not a single global result */}
      {reviewingScan && createPortal(
        <dialog ref={reviewDialogRef} aria-labelledby="scan-review-title" onCancel={(event) => { event.preventDefault(); if (!savingRef.current) setReviewingScanId(null); }} className="fixed inset-0 m-0 w-full h-dvh max-w-none max-h-none bg-surface-950 text-surface-300 p-0 open:flex flex-col safe-top">
          <div className="hazard h-1 w-full shrink-0" />
          <div ref={reviewContentRef} className="flex-1 overflow-y-auto min-h-0">
            <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h3 id="scan-review-title" className="font-display text-2xl font-bold text-surface-100">Review your photo</h3>
                <p className="text-sm text-surface-400 mt-1">Edit names, remove unwanted items, then save.</p>
                {reviewingScan.containerName && (
                  <p className="text-sm text-surface-400 mt-1">
                    Items will be filed in <span className="text-primary-400">{reviewingScan.containerName}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRescan(reviewingScanId)}
                  className="btn-secondary text-sm mr-2" disabled={saving}
                  title="Re-run AI analysis on this photo"
                >
                  <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Analyse again
                </button>
                <button
                  onClick={() => setReviewingScanId(null)}
                  className="p-3 text-surface-400 hover:text-surface-200 transition-colors" disabled={saving}
                  aria-label="Close review"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Source image */}
            {reviewingScan.imageUrl && (
              <details className="mb-6">
                <summary className="cursor-pointer py-3 text-surface-200">View photo and item locations</summary>
                <div className="relative rounded-lg overflow-hidden border border-surface-800">
                  <img src={reviewingScan.imageUrl} alt="Scanned area" className="w-full h-auto block" />
                  {/* Detector boxes — normalized 0..1, so % positioning lines up at any size */}
                  {reviewingScan.result?.items.map((item, i) => {
                    if (!item.bbox || reviewingScan.itemSkip?.[i]) return null;
                    const [x1, y1, x2, y2] = item.bbox;
                    const active = hoveredItem === i;
                    return (
                      <div
                        key={i}
                        className={`absolute border-2 pointer-events-none transition-colors ${active ? 'border-primary-300 bg-primary-500/15' : 'border-primary-500/70'}`}
                        style={{ left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%` }}
                      >
                        <span className="absolute top-0 left-0 bg-primary-500 text-surface-950 font-mono text-[0.6rem] leading-tight px-1">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            {/* Items to review */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="font-semibold text-surface-100">{selectedReviewCount} selected of {(reviewingScan.result?.items.length || 0) + (reviewingScan.result?.proposed_containers.length || 0)} found</p>
                <button className="btn-secondary text-sm" disabled={saving} onClick={() => setScans(previous => previous.map(entry => entry.sessionId === reviewingScanId ? { ...entry, itemSkip: entry.result.items.map(() => selectedReviewCount > 0), proposedSkip: entry.result.proposed_containers.map(() => selectedReviewCount > 0) } : entry))}>{selectedReviewCount ? 'Deselect all' : 'Select all'}</button>
              </div>
              {reviewingScan.result?.items.length === 0 && reviewingScan.result?.proposed_containers.length === 0 && <p className="py-4 text-surface-300">No items were found. Try a closer photo with more light.</p>}
              <fieldset disabled={saving} className="space-y-2">
                {reviewingScan.result?.items.map((item, i) => {
                  const isContainer = reviewingScan.containerFlags?.[i] ?? false;
                  const dupe = reviewingScan.dupeMatches?.[i] || null;
                  const skipped = reviewingScan.itemSkip?.[i] ?? false;
                  return (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredItem(i)}
                    onFocus={() => setHoveredItem(i)}
                    onMouseLeave={() => setHoveredItem(null)}
                    onBlur={() => setHoveredItem(null)}
                    className={`card py-3 ${isContainer ? 'border-primary-500/40' : ''} ${skipped ? 'border-dashed' : ''} ${hoveredItem === i && item.bbox ? 'ring-1 ring-primary-500/50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <label className="min-w-11 min-h-11 grid place-items-center cursor-pointer">
                        <input type="checkbox" checked={!skipped} onChange={(event) => handleItemSkipChange(i, !event.target.checked)} aria-label={`Include ${item.name || `item ${i + 1}`}`} className="w-5 h-5 accent-primary-500" />
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleEditItem(i, 'name', e.target.value)}
                        aria-label={`Item ${i + 1} name`}
                        maxLength={255}
                        className="input-field text-base flex-1 min-w-0"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-9">
                      {item.category && <span className="tag">{item.category}</span>}
                      {item.suggested_container && !isContainer && (
                        <span className="tag bg-primary-900/40 text-primary-400 border-primary-900">{item.suggested_container}</span>
                      )}
                      {isContainer && (
                        <span className="tag bg-primary-900/40 text-primary-400 border-primary-900">Container</span>
                      )}
                      {item.confidence_score < 0.8 && (
                        <span className="badge-low">Low confidence</span>
                      )}
                    </div>
                    {dupe && <p className="text-sm text-primary-400 mt-2 pl-1">Possible match: “{dupe.name}” is already in this room. Deselect this item if it is the same object.</p>}
                    <details className="mt-2 pl-1" open={reviewingScan.itemTargets?.[i]?.kind === 'missing' ? true : undefined}>
                      <summary className="cursor-pointer text-sm text-surface-300 py-2">Location and category</summary>
                      <label className="block text-sm text-surface-400 mt-2">Category
                        <input value={item.category || ''} onChange={(event) => handleEditItem(i, 'category', event.target.value)} className="input-field text-base mt-1" maxLength={100} />
                      </label>
                    {reviewingScan.containerFlags && (
                      <label className="flex items-center gap-2 mt-2 min-h-11 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isContainer}
                          onChange={(e) => handleContainerFlagChange(i, e.target.checked)}
                          className="w-4 h-4 rounded border-surface-600 bg-surface-900 accent-primary-500"
                        />
                        <span className="text-sm text-surface-400">This is a container</span>
                      </label>
                    )}
                    {/* Per-item destination — file items in, or nest containers under */}
                    {reviewingScan.existingContainers && (() => {
                      const target = reviewingScan.itemTargets?.[i] || { kind: 'loose' };
                      let selectValue = target.kind === 'missing' ? 'missing' : 'loose';
                      if (target.kind === 'existing') selectValue = `existing:${target.containerId}`;
                      else if (target.kind === 'proposed') selectValue = `proposed:${target.name}`;
                      return (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-sm text-surface-400">
                            {target.kind === 'missing' ? `${target.name} moved or was deleted` : isContainer ? 'Place under' : 'File in'}
                          </span>
                          <select
                            value={selectValue}
                            onChange={(e) => handleItemTargetChange(i, e.target.value)}
                            aria-label={`Location for ${item.name}`} className="input-field text-base flex-1 min-w-0"
                          >
                            {target.kind === 'missing' && <option value="missing" disabled>Choose a new location</option>}
                            <option value="loose">{isContainer ? 'Root in room' : 'Loose in room'}</option>
                            {reviewingScan.existingContainers.length > 0 && (
                              <optgroup label="Existing">
                                {reviewingScan.existingContainers.map(c => (
                                  <option key={c.id} value={`existing:${c.id}`}>{containerLocationLabel(c, reviewingScan.existingContainers)}</option>
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
                    </details>
                  </div>
                  );
                })}
                {reviewingScan.result?.proposed_containers.map((container, index) => {
                  const target = reviewingScan.proposedTargets?.[index] || { kind: 'loose' };
                  const required = reviewingScan.itemTargets?.some((itemTarget, itemIndex) => !reviewingScan.itemSkip?.[itemIndex] && itemTarget.kind === 'proposed' && itemTarget.name === container.name);
                  const skipped = reviewingScan.proposedSkip?.[index] && !required;
                  return <div key={`container-${index}`} className={`card py-3 ${skipped ? 'border-dashed' : ''}`}>
                    <div className="flex items-center gap-2">
                      <label className="min-w-11 min-h-11 grid place-items-center cursor-pointer">
                        <input type="checkbox" checked={!skipped} disabled={required || saving} onChange={event => handleProposedChange(index, 'skip', !event.target.checked)} aria-label={`Include container ${container.name}`} className="w-5 h-5 accent-primary-500" />
                      </label>
                      <input aria-label={`Container ${index + 1} name`} value={container.name} onChange={event => handleProposedChange(index, 'name', event.target.value)} maxLength={255} className="input-field text-base flex-1 min-w-0" />
                    </div>
                    <p className="text-sm text-surface-400 mt-2">New container{required ? ' · used by selected items' : ''}</p>
                    <label className="block text-sm text-surface-400 mt-3">{target.kind === 'missing' ? `${target.name} moved or was deleted. Choose a new parent.` : 'Place under'}
                      <select aria-label={`Parent for ${container.name}`} value={target.kind === 'missing' ? 'missing' : target.kind === 'existing' ? String(target.containerId) : 'loose'} onChange={event => handleProposedChange(index, 'target', event.target.value === 'loose' ? { kind: 'loose' } : { kind: 'existing', containerId: Number(event.target.value) })} className="input-field text-base mt-1">
                        {target.kind === 'missing' && <option value="missing" disabled>Choose a new parent</option>}
                        <option value="loose">Root in room</option>
                        {reviewingScan.existingContainers?.map(parent => <option key={parent.id} value={parent.id}>{containerLocationLabel(parent, reviewingScan.existingContainers)}</option>)}
                      </select>
                    </label>
                  </div>;
                })}
              </fieldset>
            </div>

            </div>
          </div>

          {/* Actions — always visible, pinned outside the scroll area */}
          <div className="shrink-0 border-t border-surface-800 bg-surface-950/95 backdrop-blur-sm">
            {saveError && <p role="alert" className="max-w-2xl mx-auto px-4 pt-3 text-red-400">{saveError} Your changes remain here. Try saving again.</p>}
            <div className="max-w-2xl mx-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-3">
              <button
                onClick={() => setReviewingScanId(null)} disabled={saving}
                className="btn-secondary flex-1"
              >
                Review later
              </button>
              <button
                onClick={handleAcceptAll}
                className="btn-primary flex-1"
                disabled={saving || !reviewingScan.existingContainers || selectedReviewCount === 0}
              >
                {saving ? 'Saving…' : `Save selected${ready.length > 1 ? ' and review next' : ''}`}
              </button>
            </div>
          </div>
        </dialog>, document.body
      )}

      {items.length > 0 && <label className="block text-sm text-surface-400">Find in this room<input type="search" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} className="input-field text-base mt-2" placeholder="Search names, categories, or tags" /></label>}
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
              {containerLocationLabel(container, containers)}
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

      {/* Selection-mode toolbar */}
      {filteredItems.length > 0 && (
        <div className="flex items-center justify-between gap-3 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectMode}
              className={selectMode ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
              aria-pressed={selectMode}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {selectMode ? 'Selecting' : 'Select'}
            </button>
            {selectMode && (
              <button
                type="button"
                onClick={selectedItemIds.size > 0 ? () => setSelectedItemIds(new Set()) : selectAllVisible}
                className="btn-secondary text-xs"
              >
                {selectedItemIds.size > 0 ? 'Clear all' : 'Select all'}
              </button>
            )}
          </div>
          {selectMode && selectedItemIds.size > 0 && (
            <span className="text-xs text-surface-400 font-mono">
              {selectedItemIds.size} {selectedItemIds.size === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      )}

      {/* Items grid */}
      {filteredItems.length === 0 ? (
        <div className="card text-center py-14">
          <div className="w-14 h-14 rounded-lg bg-surface-800 grid place-items-center mx-auto mb-4">
            {isEmptyContainerView ? (
              <svg className="w-7 h-7 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            )}
          </div>
          <h3 className="font-display text-lg font-semibold text-surface-200 mb-1">
            {items.length === 0
              ? 'Nothing catalogued yet'
              : isEmptyContainerView
                ? `${selectedContainerRecord?.name || 'This container'} is empty`
                : 'No items match this filter'}
          </h3>
          <p className="text-surface-500 mb-5">
            {items.length === 0
              ? 'Take a photo of a shelf or drawer. Check the items, then save them here.'
              : isEmptyContainerView
                ? 'Photograph the inside of this container to catalogue what\'s in there.'
                : 'Try a different container or category.'}
          </p>
          {(items.length === 0 || isEmptyContainerView) && (
            <button
              onClick={() => isEmptyContainerView
                ? openContainerScan(selectedContainer)
                : openCapture('camera', null)}
              className="btn-primary mx-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {isEmptyContainerView ? 'Photograph this container' : 'Take photo'}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 min-w-0 sm:grid-cols-2 lg:grid-cols-3">
            {groupItemsByName(filteredItems).map(group => (
              <ItemCard
                key={group.name}
                item={group.items[0]}
                items={group.items}
                count={group.count}
                selected={group.items.every(i => selectedItemIds.has(i.id))}
                onToggleSelect={selectMode ? () => toggleSelectGroup(group.items) : undefined}
                onOpenItem={selectMode ? undefined : () => setDetailGroup(group)}
                onMove={handleMoveSingleItem}
                onUpdate={(updates) =>
                  Promise.all(group.items.map(i => itemsApi.update(i.id, updates))).then(loadData)
                }
                onDelete={() => itemsApi.delete(group.items[0].id).then(loadData)}
                onPromote={group.count === 1
                  ? () => itemsApi.promoteToContainer(group.items[0].id).then(loadData)
                  : undefined}
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

      {/* Item detail lightbox (tap an item outside selection mode) */}
      {detailGroup && (
        <ItemDetailLightbox
          item={detailGroup.items[0]}
          items={detailGroup.items}
          count={detailGroup.count}
          onClose={() => setDetailGroup(null)}
          onMove={handleMoveSingleItem}
          onUpdate={(updates) =>
            Promise.all(detailGroup.items.map(i => itemsApi.update(i.id, updates))).then(() => {
              setDetailGroup(g => g ? { ...g, items: g.items.map(i => ({ ...i, ...updates })) } : g);
              loadData();
            })
          }
          onDelete={() => itemsApi.delete(detailGroup.items[0].id).then(() => { setDetailGroup(null); loadData(); })}
          onPromote={detailGroup.count === 1
            ? () => itemsApi.promoteToContainer(detailGroup.items[0].id).then(() => { setDetailGroup(null); loadData(); })
            : undefined}
        />
      )}
    </div>
  );
}
