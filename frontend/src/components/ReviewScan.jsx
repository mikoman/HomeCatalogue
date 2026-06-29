import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { scan } from '../api/client';

export default function ReviewScan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room_id');
  const scanSessionId = searchParams.get('session_id');

  const [scanResult, setScanResult] = useState(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!roomId || !scanSessionId) {
      navigate('/houses');
      return;
    }
    loadScanResult();
  }, [roomId, scanSessionId, navigate]);

  const loadScanResult = async () => {
    try {
      const pending = await scan.getPending(scanSessionId);
      // In a real implementation, we'd fetch the full scan result
      // For now, we'll work with what we have
      setScanResult(pending);
    } catch (err) {
      console.error('Failed to load scan result:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptAll = async () => {
    if (!scanResult) return;
    setAccepting(true);
    try {
      // Accept all items
      navigate(`/rooms/${roomId}`);
    } catch (err) {
      console.error('Failed to accept scan:', err);
    } finally {
      setAccepting(false);
    }
  };

  const handleRejectItem = (index) => {
    if (!scanResult) return;
    const updated = {
      ...scanResult,
      items: scanResult.items.filter((_, i) => i !== index),
    };
    setScanResult(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!scanResult) {
    return (
      <div className="card text-center py-12">
        <p className="text-surface-500">No scan results found</p>
        <button onClick={() => navigate(`/rooms/${roomId}`)} className="btn-secondary mt-4">
          Back to Room
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-surface-100">Review Scan</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/rooms/${roomId}`)} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleAcceptAll}
            disabled={accepting || scanResult.items.length === 0}
            className="btn-primary"
          >
            {accepting ? 'Saving...' : `Accept All (${scanResult.items.length})`}
          </button>
        </div>
      </div>

      {/* Image preview */}
      {image && (
        <div className="card">
          <img src={image} alt="Scan result" className="w-full rounded-lg" />
        </div>
      )}

      {/* Discovered items */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-surface-200">Discovered Items</h3>
        {scanResult.items.length === 0 ? (
          <p className="text-surface-500 text-center py-8">No items detected in this image</p>
        ) : (
          scanResult.items.map((item, index) => (
            <div key={index} className="card flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-surface-200 font-medium">{item.name}</h4>
                  {item.confidence_score < 0.8 && (
                    <span className="badge-low">Low confidence</span>
                  )}
                </div>
                {item.category && (
                  <span className="inline-block mt-1 badge bg-surface-800 text-surface-400">
                    {item.category}
                  </span>
                )}
                {item.suggested_container && (
                  <p className="text-sm text-surface-500 mt-1">
                    Suggested: {item.suggested_container}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleRejectItem(index)}
                className="p-2 text-surface-500 hover:text-red-400 transition-colors"
                aria-label="Reject item"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Proposed containers */}
      {scanResult.proposed_containers?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-surface-200">Proposed Containers</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {scanResult.proposed_containers.map((container, index) => (
              <div key={index} className="card">
                <h4 className="text-surface-200 font-medium">{container.name}</h4>
                {container.description && (
                  <p className="text-sm text-surface-500 mt-1">{container.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
