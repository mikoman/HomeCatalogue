import { useState } from 'react';
import { createPortal } from 'react-dom';

export default function ItemCard({
  item,
  items,
  count = 1,
  onUpdate,
  onDelete,
  onMove,
  onPromote,
  selected,
  onToggleSelect,
}) {
  const groupItems = items ?? [item];
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState(item.category || '');
  const [showDelete, setShowDelete] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState(null);
  const selectable = typeof onToggleSelect === 'function';
  const isGrouped = count > 1;

  const handleSave = async () => {
    if (!editName.trim()) return;
    await onUpdate({
      name: editName.trim(),
      category: editCategory.trim() || null,
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
      setIsEditing(false);
    } catch (err) {
      setPromoteError(err.message || 'Could not convert to container');
    } finally {
      setPromoting(false);
    }
  };

  const openPromoteModal = () => {
    setPromoteError(null);
    setShowPromote(true);
  };

  const getConfidenceBadge = () => {
    if (item.confidence_score === null || item.confidence_score >= 0.9) return null;
    const pct = Math.round(item.confidence_score * 100);
    const cls = item.confidence_score >= 0.7 ? 'badge-medium' : 'badge-low';
    return <span className={cls}>AI·{pct}%</span>;
  };

  const promoteModal = showPromote && createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => !promoting && setShowPromote(false)}
    >
      <div
        className="card w-full max-w-md animate-rise mx-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="promote-title"
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
            <h3 id="promote-title" className="font-display text-xl font-semibold text-surface-100">
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

  if (isEditing) {
    return (
      <>
      <div className="card">
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
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary text-sm flex-1">Save</button>
            <button onClick={() => setIsEditing(false)} className="btn-secondary text-sm flex-1">Cancel</button>
          </div>
          {!isGrouped && onPromote && (
            <button
              type="button"
              onClick={openPromoteModal}
              className="btn-secondary text-sm w-full"
            >
              Make container
            </button>
          )}
        </div>
      </div>
      {promoteModal}
      </>
    );
  }

  return (
    <div
      className={`card group hover:border-surface-600 transition-all min-w-0 overflow-hidden ${selected ? 'border-primary-500 ring-1 ring-primary-500/40' : ''}`}
      onClick={selectable ? () => onToggleSelect() : undefined}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex-1 min-w-0 flex items-start gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect()}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 w-4 h-4 rounded border-surface-600 bg-surface-900 accent-primary-500 flex-shrink-0"
              aria-label={`Select ${item.name}`}
            />
          )}
          <div className="flex-1 min-w-0">
            {!isGrouped && (
              <span className="font-mono text-[0.62rem] text-surface-600 tracking-wider">
                #{String(item.id).padStart(4, '0')}
              </span>
            )}
            <h3 className="text-surface-100 font-medium truncate mt-0.5">
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
                {item.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="font-mono text-[0.7rem] text-surface-500">#{tag}</span>
                ))}
                {item.tags.length > 3 && (
                  <span className="font-mono text-[0.7rem] text-surface-600">+{item.tags.length - 3}</span>
                )}
              </div>
            )}
            {item.date_added && !isGrouped && (
              <p className="font-mono text-[0.62rem] text-surface-600 mt-2.5">
                {new Date(item.date_added).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setEditName(item.name); setEditCategory(item.category || ''); setIsEditing(true); }}
            className="p-1.5 text-surface-500 hover:text-primary-400 transition-colors"
            aria-label="Edit item"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="p-1.5 text-surface-500 hover:text-red-400 transition-colors"
            aria-label="Delete item"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {onMove && (
            <button
              onClick={(e) => onMove(groupItems.map(i => i.id), e)}
              className="p-1.5 text-surface-500 hover:text-primary-400 transition-colors"
              aria-label={`Move ${item.name}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m0 0l-3-3m3 3l-3 3" />
              </svg>
            </button>
          )}
          {!isGrouped && onPromote && (
            <button
              onClick={openPromoteModal}
              className="p-1.5 text-surface-500 hover:text-primary-400 transition-colors"
              aria-label={`Make ${item.name} a container`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showDelete && (
        <div className="mt-3 pt-3 border-t border-surface-800" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-surface-400 mb-2">
            {isGrouped ? `Remove 1 of ${count}?` : 'Delete this item?'}
          </p>
          <div className="flex gap-2">
            <button onClick={handleDelete} className="btn-danger text-xs px-3 py-1.5">Delete</button>
            <button onClick={() => setShowDelete(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      {promoteModal}
    </div>
  );
}
