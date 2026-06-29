import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rooms as roomsApi, items as itemsApi, containers as containersApi, scan } from '../api/client';
import { compressImage } from '../utils/imageCompression';
import ItemCard from './ItemCard';
import ContainerTree from './ContainerTree';

export default function RoomView() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanImage, setScanImage] = useState(null);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);

  useEffect(() => {
    loadData();
  }, [roomId]);

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

  const handleScan = async (file) => {
    setScanning(true);
    setScanError(null);
    try {
      // Compress image before upload
      const compressed = await compressImage(file, { maxWidth: 1280, quality: 0.7 });
      const scanResult = await scan.upload(roomId, compressed);
      setScanResult(scanResult);
      setScanImage(URL.createObjectURL(compressed));
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleScan(file);
    }
    // Reset input
    e.target.value = null;
  };

  const handleAcceptAll = async () => {
    if (!scanResult) return;

    try {
      const itemsToCreate = scanResult.items.map(item => ({
        room_id: parseInt(roomId),
        name: item.name,
        category: item.category,
        tags: item.tags,
        container_id: null,
        confidence_score: item.confidence_score,
        scan_session_id: null,
      }));

      // Create containers first
      const createdContainers = [];
      for (const container of scanResult.proposed_containers) {
        const c = await containersApi.create({
          room_id: parseInt(roomId),
          name: container.name,
          description: container.description,
        });
        createdContainers.push(c);
      }

      // Map suggested containers to IDs
      const containerMap = {};
      createdContainers.forEach(c => {
        containerMap[c.name.toLowerCase()] = c.id;
      });

      // Create items with container assignments
      const itemsToCreateWithContainers = itemsToCreate.map(item => ({
        ...item,
        container_id: item.suggested_container
          ? containerMap[item.suggested_container.toLowerCase()] || null
          : null,
      }));

      await itemsApi.bulkCreate({ items: itemsToCreateWithContainers });

      // Refresh data
      await loadData();
      setScanResult(null);
      setScanImage(null);
    } catch (err) {
      console.error('Failed to accept scan results:', err);
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

  const handleEditItem = (index, field, value) => {
    if (!scanResult) return;
    const updated = {
      ...scanResult,
      items: scanResult.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    };
    setScanResult(updated);
  };

  const filteredItems = selectedContainer
    ? items.filter(item => item.container_id === selectedContainer)
    : filterCategory
      ? items.filter(item => item.category === filterCategory)
      : items;

  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="card border-red-800">
        <p className="text-red-400">Room not found</p>
        <button onClick={() => navigate('/houses')} className="btn-secondary mt-3">Back to Houses</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Room header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/houses')}
            className="text-sm text-surface-500 hover:text-surface-300 mb-2 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-2xl font-bold text-surface-100">{room.name}</h2>
          {room.description && (
            <p className="text-surface-500 mt-1">{room.description}</p>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary"
          disabled={scanning}
        >
          {scanning ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Scan Area
            </>
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

      {/* Scan result overlay */}
      {scanResult && (
        <div className="fixed inset-0 bg-surface-950 z-50 overflow-y-auto safe-top safe-bottom">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-surface-100">Review Scan</h3>
              <button
                onClick={() => { setScanResult(null); setScanImage(null); }}
                className="p-2 text-surface-500 hover:text-surface-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Source image */}
            {scanImage && (
              <div className="mb-6 rounded-xl overflow-hidden border border-surface-800">
                <img src={scanImage} alt="Scan source" className="w-full h-auto" />
              </div>
            )}

            {/* Proposed containers */}
            {scanResult.proposed_containers.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-surface-400 mb-2">Proposed Containers</h4>
                <div className="space-y-2">
                  {scanResult.proposed_containers.map((container, i) => (
                    <div key={i} className="card flex items-center gap-3">
                      <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <div>
                        <p className="text-surface-200 font-medium">{container.name}</p>
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
              <h4 className="text-sm font-medium text-surface-400 mb-2">
                Discovered Items ({scanResult.items.length})
              </h4>
              <div className="space-y-2">
                {scanResult.items.map((item, i) => (
                  <div key={i} className="card flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleEditItem(i, 'name', e.target.value)}
                          className="input-field text-sm py-1.5 flex-1"
                        />
                        <button
                          onClick={() => handleRejectItem(i)}
                          className="p-1.5 text-surface-500 hover:text-red-400 transition-colors"
                          aria-label="Remove item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {item.category && (
                          <span className="badge bg-surface-800 text-surface-400">{item.category}</span>
                        )}
                        {item.suggested_container && (
                          <span className="badge bg-primary-900/30 text-primary-400">{item.suggested_container}</span>
                        )}
                        {item.confidence_score < 0.8 && (
                          <span className="badge-low">Low confidence</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {scanError && (
              <div className="card border-red-800 mb-4">
                <p className="text-red-400 text-sm">{scanError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 sticky bottom-0 bg-surface-950 pt-4 pb-6 safe-bottom">
              <button
                onClick={() => { setScanResult(null); setScanImage(null); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptAll}
                className="btn-primary flex-1"
              >
                Accept All ({scanResult.items.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => { setSelectedContainer(null); setFilterCategory(null); }}
          className={`badge ${!selectedContainer && !filterCategory ? 'bg-primary-900/50 text-primary-400' : 'bg-surface-800 text-surface-400'}`}
        >
          All Items ({items.length})
        </button>
        {containers.map(container => (
          <button
            key={container.id}
            onClick={() => setSelectedContainer(selectedContainer === container.id ? null : container.id)}
            className={`badge ${selectedContainer === container.id ? 'bg-primary-900/50 text-primary-400' : 'bg-surface-800 text-surface-400'}`}
          >
            {container.name}
          </button>
        ))}
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setFilterCategory(filterCategory === category ? null : category)}
            className={`badge ${filterCategory === category ? 'bg-primary-900/50 text-primary-400' : 'bg-surface-800 text-surface-400'}`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Container tree */}
      {containers.length > 0 && (
        <ContainerTree
          containers={containers}
          items={items}
          roomId={roomId}
          selectedContainer={selectedContainer}
          onSelectContainer={setSelectedContainer}
        />
      )}

      {/* Items grid */}
      {filteredItems.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-surface-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-lg font-medium text-surface-300 mb-2">No items yet</h3>
          <p className="text-surface-500 mb-4">Tap "Scan Area" to start adding items with AI</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Scan Area
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onUpdate={(updates) => itemsApi.update(item.id, updates).then(loadData)}
              onDelete={() => itemsApi.delete(item.id).then(loadData)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
