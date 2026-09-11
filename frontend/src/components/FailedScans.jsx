import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { scan } from '../api/client';
import { enqueueRoomScan } from '../utils/scanStorage';

const POLL_INTERVAL_MS = 3000;
function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FailedScans() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState({});
  const [retryStatus, setRetryStatus] = useState({});
  const timersRef = useRef(new Map());
  const activePollsRef = useRef(new Map());
  const busyRef = useRef(new Set());
  const mountedRef = useRef(false);
  const [dismissing, setDismissing] = useState({});

  const clearTimer = useCallback((sessionId) => {
    const t = timersRef.current.get(sessionId);
    if (t) clearTimeout(t);
    timersRef.current.delete(sessionId);
  }, []);

  const loadFailed = useCallback(async () => {
    try {
      const data = await scan.listFailed();
      if (!mountedRef.current) return;
      setFailed(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadFailed();
    return () => {
      mountedRef.current = false;
      activePollsRef.current.clear();
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [loadFailed]);

  const pollRetry = useCallback((sessionId, roomId) => {
    const token = Symbol(sessionId);
    activePollsRef.current.set(sessionId, token);
    const poll = async () => {
      try {
        const data = await scan.getStatus(sessionId);
        if (!mountedRef.current || activePollsRef.current.get(sessionId) !== token) return;
        setRetryStatus((prev) => ({ ...prev, [sessionId]: data.status }));

        if (data.status === 'completed') {
          clearTimer(sessionId);
          setRetrying((prev) => ({ ...prev, [sessionId]: false }));
          enqueueRoomScan(data.room_id ?? roomId, sessionId);
          activePollsRef.current.delete(sessionId);
          busyRef.current.delete(sessionId);
          navigate(`/rooms/${data.room_id ?? roomId}?review=${encodeURIComponent(sessionId)}`);
          return;
        }
        if (['failed', 'filed'].includes(data.status)) {
          clearTimer(sessionId);
          setRetrying((prev) => ({ ...prev, [sessionId]: false }));
          activePollsRef.current.delete(sessionId);
          busyRef.current.delete(sessionId);
          await loadFailed();
          return;
        }
        timersRef.current.set(sessionId, setTimeout(poll, POLL_INTERVAL_MS));
      } catch (err) {
        if (!mountedRef.current || activePollsRef.current.get(sessionId) !== token) return;
        if (err.status === 404) {
          clearTimer(sessionId);
          activePollsRef.current.delete(sessionId);
          busyRef.current.delete(sessionId);
          setRetrying(previous => ({ ...previous, [sessionId]: false }));
          await loadFailed();
          return;
        }
        setRetryStatus(previous => ({ ...previous, [sessionId]: 'reconnecting' }));
        timersRef.current.set(sessionId, setTimeout(poll, 10000));
      }
    };
    poll();
  }, [clearTimer, loadFailed, navigate]);

  const handleRetry = async (entry) => {
    const { scan_session_id: sessionId, room_id: roomId } = entry;
    if (busyRef.current.has(sessionId)) return;
    busyRef.current.add(sessionId);
    setRetrying((prev) => ({ ...prev, [sessionId]: true }));
    setRetryStatus((prev) => ({ ...prev, [sessionId]: 'pending' }));
    setError(null);
    try {
      await scan.retry(sessionId);
      enqueueRoomScan(roomId, sessionId);
      if (!mountedRef.current) return;
      pollRetry(sessionId, roomId);
    } catch (err) {
      busyRef.current.delete(sessionId);
      setRetrying((prev) => ({ ...prev, [sessionId]: false }));
      setError(err.message);
    }
  };

  const handleDismiss = async (sessionId) => {
    if (busyRef.current.has(sessionId)) return;
    busyRef.current.add(sessionId);
    setDismissing(previous => ({ ...previous, [sessionId]: true }));
    try {
      await scan.dismiss(sessionId);
      setFailed((prev) => prev.filter((f) => f.scan_session_id !== sessionId));
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current.delete(sessionId);
      setDismissing(previous => ({ ...previous, [sessionId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-surface-800 border-t-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-surface-100 mt-1">
          Photos to retry
        </h1>
        <p className="text-surface-400 mt-2">
          Your photos stay here when analysis fails. Try again, or dismiss photos you no longer need.
        </p>
      </header>

      {error && (
        <div className="card border-red-900 bg-red-950/30 py-3">
          <p className="text-red-400 text-sm" role="alert">{error}</p>
          <button onClick={loadFailed} className="btn-secondary mt-3">Refresh photos</button>
        </div>
      )}

      {failed.length === 0 && !error ? (
        <div className="card text-center py-14">
          <div className="w-14 h-14 rounded-lg bg-surface-800 grid place-items-center mx-auto mb-4">
            <svg className="w-7 h-7 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-semibold text-surface-200 mb-1">No failed scans</h2>
          <p className="text-surface-500 text-sm">When AI analysis fails, the photo is saved here for retry.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {failed.map((entry) => {
            const isRetrying = retrying[entry.scan_session_id];
            const status = retryStatus[entry.scan_session_id];
            return (
              <div key={entry.scan_session_id} className="card overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-4">
                  {entry.image_url ? (
                    <div className="sm:w-40 flex-shrink-0">
                      <img
                        src={entry.image_url}
                        alt="Failed scan"
                        className="w-full sm:w-40 h-32 sm:h-28 object-cover rounded-lg border border-surface-800"
                      />
                    </div>
                  ) : (
                    <div className="sm:w-40 h-28 rounded-lg bg-surface-800 border border-surface-700 grid place-items-center flex-shrink-0">
                      <span className="text-xs text-surface-500">Image unavailable</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {!isRetrying && <span className="tag bg-red-950/50 text-red-400 border-red-900">Needs another attempt</span>}
                      {isRetrying && (
                        <span className="tag bg-primary-900/40 text-primary-400 border-primary-900">
                          {status === 'reconnecting' ? 'Waiting for connection…' : status === 'processing' ? 'Analysing…' : 'Queued…'}
                        </span>
                      )}
                    </div>

                    <p className="text-surface-100 font-medium">
                      <Link to={`/houses/${entry.house_id}`} className="hover:text-primary-400 transition-colors">
                        {entry.house_name}
                      </Link>
                      <span className="text-surface-600 mx-1.5">/</span>
                      <Link to={`/rooms/${entry.room_id}`} className="hover:text-primary-400 transition-colors">
                        {entry.room_name}
                      </Link>
                      {entry.container_name && (
                        <>
                          <span className="text-surface-600 mx-1.5">/</span>
                          <span className="text-surface-300">{entry.container_name}</span>
                        </>
                      )}
                    </p>

                    {entry.error && (
                      <p className="text-sm text-red-400/90 mt-2 leading-relaxed">{entry.error}</p>
                    )}

                    <p className="text-sm text-surface-400 mt-2">
                      {formatWhen(entry.completed_at || entry.created_at)}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => handleRetry(entry)}
                        disabled={isRetrying || dismissing[entry.scan_session_id]}
                        className="btn-primary text-sm"
                      >
                        {isRetrying ? 'Retrying…' : 'Retry analysis'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismiss(entry.scan_session_id)}
                        disabled={isRetrying || dismissing[entry.scan_session_id]}
                        className="btn-secondary text-sm"
                      >
                        {dismissing[entry.scan_session_id] ? 'Dismissing…' : 'Dismiss'}
                      </button>
                      <Link to={`/rooms/${entry.room_id}`} className="btn-secondary text-sm">
                        Open room
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
