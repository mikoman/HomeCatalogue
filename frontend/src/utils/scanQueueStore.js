import { clearReviewDraft, readActiveScans, readReviewDraft, writeActiveScans, writeReviewDraft } from './scanStorage.js';

const localScan = id => id.startsWith('upload:');
const terminal = status => ['completed', 'failed', 'filed'].includes(status);
const emptyScan = sessionId => ({ sessionId, status: 'pending', imageUrl: null, result: null, error: null });

export function createUploadRequestId(cryptoSource = globalThis.crypto) {
  if (cryptoSource?.randomUUID) return cryptoSource.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoSource?.getRandomValues) cryptoSource.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createScanQueue({ api, compressImage, storage, createObjectURL = file => URL.createObjectURL(file), revokeObjectURL = url => URL.revokeObjectURL(url), schedule = setTimeout, cancel = clearTimeout, browserWindow = globalThis.window }) {
  const rooms = new Map();
  const listeners = new Map();
  const polls = new Map();
  const files = new Map();
  const operations = new Set();
  const hydration = new Map();
  const dismissed = new Set();
  let uploadChain = Promise.resolve();
  let reloadWarning = false;
  const warnBeforeReload = event => { event.preventDefault(); event.returnValue = ''; };

  const snapshot = roomId => {
    const key = String(roomId);
    if (!rooms.has(key)) rooms.set(key, { scans: readActiveScans(key, storage).map(emptyScan), error: null, relocated: [] });
    return rooms.get(key);
  };
  const updateWarning = () => {
    const needed = files.size > 0;
    if (needed === reloadWarning) return;
    reloadWarning = needed;
    browserWindow?.[needed ? 'addEventListener' : 'removeEventListener']('beforeunload', warnBeforeReload);
  };
  const publish = (roomId, changes) => {
    const key = String(roomId);
    const previous = snapshot(key);
    const next = { ...previous, ...changes };
    rooms.set(key, next);
    writeActiveScans(key, next.scans.filter(entry => !localScan(entry.sessionId)).map(entry => entry.sessionId), storage);
    if (changes.scans) {
      next.scans.filter(entry => entry.status === 'completed' && entry.existingContainers).forEach(entry => {
        const { result, resultRevision, existingContainers, itemTargets, containerFlags, dupeMatches, itemSkip, proposedSkip, proposedTargets } = entry;
        if (!writeReviewDraft(entry.sessionId, { result, resultRevision, existingContainers, itemTargets, containerFlags, dupeMatches, itemSkip, proposedSkip, proposedTargets }, storage)) {
          next.error = 'This browser cannot keep review edits after a refresh. Save your review before leaving.';
        }
      });
    }
    listeners.get(key)?.forEach(listener => listener());
    updateWarning();
  };
  const setScans = (roomId, updater) => {
    const before = snapshot(roomId).scans;
    const scans = typeof updater === 'function' ? updater(before) : updater;
    if (scans !== before) publish(roomId, { scans });
  };
  const findScan = sessionId => {
    for (const [roomId, state] of rooms) {
      const entry = state.scans.find(scan => scan.sessionId === sessionId);
      if (entry) return { roomId, entry };
    }
    return null;
  };
  const forget = (roomId, sessionId) => {
    dismissed.add(sessionId);
    const current = findScan(sessionId);
    if (current?.entry.imageUrl?.startsWith('blob:')) revokeObjectURL(current.entry.imageUrl);
    files.delete(sessionId);
    clearReviewDraft(sessionId, storage);
    setScans(roomId, previous => previous.filter(entry => entry.sessionId !== sessionId));
  };
  const stopPolling = sessionId => {
    const poll = polls.get(sessionId);
    if (poll?.timer) cancel(poll.timer);
    polls.delete(sessionId);
  };
  const applyStatus = (fallbackRoomId, data) => {
    const sessionId = data.scan_session_id;
    if (dismissed.has(sessionId)) return data;
    const found = findScan(sessionId);
    const sourceRoomId = found?.roomId || String(fallbackRoomId);
    const targetRoomId = String(data.room_id ?? fallbackRoomId);
    const previous = found?.entry || emptyScan(sessionId);
    if (['filed', 'dismissed', 'saved', 'accepted'].includes(data.status)) {
      forget(sourceRoomId, sessionId);
      stopPolling(sessionId);
      return data;
    }
    const savedDraft = data.status === 'completed' ? readReviewDraft(sessionId, storage) : null;
    const sameRevision = previous.resultRevision === data.result_revision && previous.existingContainers;
    const draft = sameRevision ? previous : savedDraft?.resultRevision === data.result_revision ? savedDraft : null;
    if (savedDraft && savedDraft.resultRevision !== data.result_revision) clearReviewDraft(sessionId, storage);
    const entry = {
      ...emptyScan(sessionId),
      ...(draft || {}),
      sessionId,
      roomId: Number(targetRoomId),
      resultRevision: data.result_revision,
      status: data.status,
      imageUrl: previous.imageUrl || data.image_url,
      containerId: data.container_id ?? null,
      containerName: data.container_name || null,
      result: draft && data.status === 'completed' ? draft.result : data.result,
      error: data.error,
      connectionError: null,
    };
    if (targetRoomId !== sourceRoomId) {
      publish(sourceRoomId, {
        scans: snapshot(sourceRoomId).scans.filter(scan => scan.sessionId !== sessionId),
        relocated: [...snapshot(sourceRoomId).relocated.filter(scan => scan.sessionId !== sessionId), { sessionId, roomId: Number(targetRoomId) }],
      });
    }
    setScans(targetRoomId, scans => scans.some(scan => scan.sessionId === sessionId)
      ? scans.map(scan => scan.sessionId === sessionId ? entry : scan) : [...scans, entry]);
    return data;
  };
  const refreshScan = async (roomId, sessionId) => {
    const data = await api.getStatus(sessionId);
    return applyStatus(roomId, data);
  };
  const startPolling = (roomId, sessionId) => {
    if (polls.has(sessionId)) return;
    const token = { timer: null };
    polls.set(sessionId, token);
    let failures = 0;
    const poll = async () => {
      if (polls.get(sessionId) !== token) return;
      try {
        const data = await api.getStatus(sessionId);
        if (polls.get(sessionId) !== token) return;
        applyStatus(roomId, data);
        failures = 0;
        if (terminal(data.status)) { stopPolling(sessionId); return; }
      } catch (error) {
        if (polls.get(sessionId) !== token) return;
        if (error.status === 404) {
          forget(findScan(sessionId)?.roomId || roomId, sessionId);
          stopPolling(sessionId);
          return;
        }
        failures += 1;
        const currentRoomId = findScan(sessionId)?.roomId || roomId;
        setScans(currentRoomId, scans => scans.map(entry => entry.sessionId === sessionId
          ? { ...entry, connectionError: 'The connection was interrupted. We will check this scan again.' } : entry));
      }
      token.timer = schedule(poll, Math.min(3000 * 2 ** failures, 30000));
    };
    poll();
  };
  const hydrate = roomId => {
    const key = String(roomId);
    if (hydration.has(key)) return hydration.get(key);
    snapshot(key).scans.filter(entry => !localScan(entry.sessionId)).forEach(entry => startPolling(key, entry.sessionId));
    const pending = api.listActive(key).then(entries => {
      entries.forEach(data => {
        if (!findScan(data.scan_session_id)) applyStatus(key, data);
        if (!terminal(data.status)) startPolling(key, data.scan_session_id);
      });
    }).catch(() => publish(key, { error: 'Saved scans could not load. Refresh this page to try again.' })).finally(() => hydration.delete(key));
    hydration.set(key, pending);
    return pending;
  };
  const subscribe = (roomId, listener) => {
    const key = String(roomId);
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(listener);
    hydrate(key);
    return () => listeners.get(key)?.delete(listener);
  };

  const upload = async localId => {
    const job = files.get(localId);
    if (!job) return;
    const update = changes => setScans(job.roomId, scans => scans.map(entry => entry.sessionId === localId ? { ...entry, ...changes } : entry));
    try {
      update({ status: 'preparing', error: null });
      const compressed = await compressImage(job.file);
      update({ status: 'uploading' });
      const result = await api.upload(job.roomId, compressed, { containerId: job.containerId, requestId: localId.slice('upload:'.length) });
      files.delete(localId);
      update({ sessionId: result.scan_session_id, status: 'pending' });
      startPolling(job.roomId, result.scan_session_id);
    } catch (error) {
      update({ status: 'upload_failed', error: error.message });
    }
  };
  const addFiles = (roomId, selectedFiles, containerId = null, containerName = null) => {
    if (selectedFiles.length > 20) {
      publish(roomId, { error: 'Choose up to 20 photos at once. Add more photos after this batch uploads.' });
      return;
    }
    const entries = selectedFiles.map(file => {
      const id = createUploadRequestId();
      const sessionId = `upload:${id}`;
      files.set(sessionId, { roomId: String(roomId), file, containerId });
      return { ...emptyScan(sessionId), status: 'waiting', imageUrl: createObjectURL(file), containerId, containerName, fileName: file.name };
    });
    publish(roomId, { scans: [...snapshot(roomId).scans, ...entries], error: null });
    entries.forEach(entry => { uploadChain = uploadChain.then(() => upload(entry.sessionId)); });
  };
  const retryScan = async (roomId, sessionId) => {
    if (operations.has(sessionId)) return;
    operations.add(sessionId);
    publish(roomId, { error: null });
    if (files.has(sessionId)) {
      setScans(roomId, scans => scans.map(entry => entry.sessionId === sessionId ? { ...entry, status: 'waiting', error: null } : entry));
      uploadChain = uploadChain.then(() => upload(sessionId)).finally(() => operations.delete(sessionId));
      return uploadChain;
    }
    try {
      const data = await api.retry(sessionId);
      stopPolling(sessionId);
      applyStatus(roomId, data);
      startPolling(roomId, sessionId);
    } catch (error) {
      publish(roomId, { error: error.message });
      // Check the server because it can start a retry before the response fails.
      startPolling(roomId, sessionId);
    } finally { operations.delete(sessionId); }
  };
  const removeScan = async (roomId, sessionId, { dismiss = true } = {}) => {
    if (operations.has(sessionId)) return false;
    operations.add(sessionId);
    try {
      if (!localScan(sessionId) && dismiss) await api.dismiss(sessionId);
      stopPolling(sessionId);
      forget(roomId, sessionId);
      return true;
    } catch (error) {
      publish(roomId, { error: error.message });
      return false;
    } finally { operations.delete(sessionId); }
  };
  return {
    snapshot, subscribe, hydrate, setScans, addFiles, retryScan, removeScan, refreshScan,
    setError: (roomId, error) => publish(roomId, { error }),
    whenUploadsSettle: () => uploadChain,
    dispose: () => { polls.forEach((_, id) => stopPolling(id)); browserWindow?.removeEventListener('beforeunload', warnBeforeReload); },
  };
}
