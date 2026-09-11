import { useCallback, useSyncExternalStore } from 'react';
import { scan } from '../api/client';
import { compressImage } from '../utils/imageCompression';
import { createScanQueue } from '../utils/scanQueueStore';

const queue = createScanQueue({ api: scan, compressImage });

export default function useScanQueue(roomId) {
  const subscribe = useCallback(listener => queue.subscribe(roomId, listener), [roomId]);
  const getSnapshot = useCallback(() => queue.snapshot(roomId), [roomId]);
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return {
    ...state,
    setScans: useCallback(updater => queue.setScans(roomId, updater), [roomId]),
    addFiles: useCallback((files, containerId, containerName) => queue.addFiles(roomId, files, containerId, containerName), [roomId]),
    retryScan: useCallback(sessionId => queue.retryScan(roomId, sessionId), [roomId]),
    removeScan: useCallback((sessionId, options) => queue.removeScan(roomId, sessionId, options), [roomId]),
    refreshScan: useCallback(sessionId => queue.refreshScan(roomId, sessionId), [roomId]),
    getScan: useCallback(sessionId => queue.snapshot(roomId).scans.find(entry => entry.sessionId === sessionId), [roomId]),
    setError: useCallback(error => queue.setError(roomId, error), [roomId]),
  };
}
