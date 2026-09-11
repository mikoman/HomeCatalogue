import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { scan } from '../api/client';
import { enqueueRoomScan } from '../utils/scanStorage';

export default function ReviewScan() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState(null);
  const sessionId = params.get('session_id');
  const requestedRoomId = params.get('room_id');

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setError('This review link has no scan. Open a room to find your photos.');
      return;
    }
    scan.getStatus(sessionId).then(result => {
      if (cancelled) return;
      const roomId = result.room_id || requestedRoomId;
      if (!roomId) throw new Error('The room for this photo could not be found.');
      enqueueRoomScan(roomId, sessionId);
      navigate(`/rooms/${roomId}?review=${encodeURIComponent(sessionId)}`, { replace: true });
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [sessionId, requestedRoomId, navigate]);

  return (
    <div className="card py-8">
      {error ? <><p role="alert" className="text-red-400">{error}</p><Link to="/houses" className="btn-secondary mt-4">Open houses</Link></>
        : <p role="status" className="text-surface-300">Opening your scan review…</p>}
    </div>
  );
}
