import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cropStyle } from '../utils/cropStyle';

export default function ItemDetailLightbox({
  item,
  items,
  count = 1,
  onClose,
  onUpdate,
  onDelete,
  onMove,
  onPromote,
}) {
  const groupItems = items ?? [item];
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState(item.category || '');
  const [editNotes, setEditNotes] = useState(item.notes || '');
  const [showDelete, setShowDelete] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState(null);
  const isGrouped = count > 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !promoting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, promoting]);

  const handleSave = async () => {
    if (!editName.trim()) return;
    await onUpdate({
      name: editName.trim(),
      category: editCategory.trim() || null,
      notes: editNotes.trim(),
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    const label = isGrouped
      ? `Remove 1 of ${count} "${item.name}"?`
      : `Delete "${item.name}"?`;
    if (!confirm(label)) return;
    await onDelete();
  };

  const handlePromote = async () => {
    setPromoting(true);
    setPromoteError(null);
    try {
      await onPromote();
      setShowPromote(false);
    } catch (err) {
      setPromoteError(err.message || 'Could not convert to container');
    } finally {
      setPromoting(false);
    }
  };

  const getConfidenceBadge = () => {
    if (item.confidence_score === null || item.confidence_score >= 0.9) return null;
    const pct = Math.round(item.confidence_score * 100);
    const cls = item.confidence_score >= 0.7 ? 'badge-medium' : 'badge-low';
    return <span className={cls}>AI·{pct}%</span>;
  };

  const cropped = item.image_url && item.bbox && cropStyle(item.image_url, item.bbox);

  const promoteModal = showPromote && createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={() => !promoting && setShowPromote(false)}
    >
      <div
        className="card w-full max-w-md animate-rise mx-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="detail-promote-title"
        aria-modal="true"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary-950/50 border border-primary-900/50 grid place-items-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="eyebrow mb-1">Make container</p>
            <h3 id="detail-promote-title" className="font-display text-xl font-semibold text-surface-100">
              Convert “{item.name}”?
            </h3>
          </div>
        </div>

        <p className="text-sm text-surface-400 mb-4">
          This item will be removed from the catalogue and added to the container tree. You can then scan inside it and file other items there.
        </p>

        {promoteError && (
          <div className="card border-red-900 bg-red-950/30 mb-4 py-2.5 px-3">
            <p className="text-red-400 text-sm">{promoteError}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handlePromote}
            disabled={promoting}
            className="btn-primary flex-1 order-1 sm:order-2"
          >
            {promoting ? 'Converting…' : 'Convert to container'}
          </button>
          <button
            type="button"
            onClick={() => setShowPromote(false)}
            disabled={promoting}
            className="btn-secondary flex-1 order-2 sm:order-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl animate-rise mx-auto my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="detail-title"
        aria-modal="true"
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-surface-400 hover:text-surface-100 transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Large image */}
        <div className="flex justify-center bg-surface-950/60 rounded-t-xl border-b border-surface-800 p-4">
          {item.image_url ? (
            cropped ? (
              <div
                aria-hidden
                style={cropStyle(item.image_url, item.bbox)}
                className="w-full max-h-[55vh] aspect-square rounded-lg border border-surface-800 bg-surface-900"
              />
            ) : (
              <img
                src={item.image_url}
                alt={item.name}
                className="max-h-[55vh] max-w-full rounded-lg border border-surface-800 object-contain"
              />
            )
          ) : (
            <div className="w-full max-h-[55vh] aspect-square rounded-lg border border-surface-800 bg-surface-900 grid place-items-center">
              <svg className="w-12 h-12 text-surface-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Details / actions */}
        <div className="p-4 sm:p-5 space-y-3">
          {isEditing ? (
            <div className="space-y-3">
              {isGrouped && (
                <p className="text-xs text-surface-500">
                  Renaming all {count} items in this group.
                </p>
              )}
              <div>
                <label className="block font-mono text-[0.62rem] uppercase tracking-wider text-surface-500 mb-1">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-mono text-[0.62rem] uppercase tracking-wider text-surface-500 mb-1">Category</label>
                <input
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="e.g. Electronics, Food"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block font-mono text-[0.62rem] uppercase tracking-wider text-surface-500 mb-1">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes"
                  className="input-field text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} className="btn-primary text-sm flex-1">Save</button>
                <button onClick={() => setIsEditing(false)} className="btn-secondary text-sm flex-1">Cancel</button>
              </div>
              {!isGrouped && onPromote && (
                <button
                  type="button"
                  onClick={() => setShowPromote(true)}
                  className="btn-secondary text-sm w-full"
                >
                  Make container
                </button>
              )}
            </div>
          ) : showDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-surface-300">
                {isGrouped ? `Remove 1 of ${count} "${item.name}"?` : `Delete "${item.name}"?`}
              </p>
              <div className="flex gap-2">
                <button onClick={handleDelete} className="btn-danger text-sm flex-1">Delete</button>
                <button onClick={() => setShowDelete(false)} className="btn-secondary text-sm flex-1">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  {!isGrouped && (
                    <span className="font-mono text-[0.62rem] text-surface-600 tracking-wider">
                      #{String(item.id).padStart(4, '0')}
                    </span>
                  )}
                  <h3 id="detail-title" className="font-display text-xl font-semibold text-surface-100 truncate mt-0.5">
                    {item.name}
                    {isGrouped && (
                      <span className="text-surface-400 font-normal ml-1.5">×{count}</span>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {item.category && <span className="tag">{item.category}</span>}
                    {getConfidenceBadge()}
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
                      {item.tags.map(tag => (
                        <span key={tag} className="font-mono text-[0.7rem] text-surface-500">#{tag}</span>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-sm text-surface-400 mt-3 whitespace-pre-wrap">{item.notes}</p>
                  )}
                  {item.date_added && (
                    <p className="font-mono text-[0.62rem] text-surface-600 mt-3">
                      {new Date(item.date_added).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-surface-800">
                <button
                  onClick={() => { setEditName(item.name); setEditCategory(item.category || ''); setEditNotes(item.notes || ''); setIsEditing(true); }}
                  className="btn-secondary text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setShowDelete(true)}
                  className="btn-secondary text-sm text-red-400 hover:text-red-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
                {onMove && (
                  <button
                    onClick={() => onMove(groupItems.map(i => i.id))}
                    className="btn-secondary text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m0 0l-3-3m3 3l-3 3" />
                    </svg>
                    Move
                  </button>
                )}
                {!isGrouped && onPromote && (
                  <button
                    onClick={() => setShowPromote(true)}
                    className="btn-secondary text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Make container
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {promoteModal}
      </div>
    </div>,
    document.body,
  );
}
