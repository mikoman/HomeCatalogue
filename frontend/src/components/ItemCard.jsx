import { useId, useRef, useState } from 'react';
import { cropStyle } from '../utils/cropStyle';

export default function ItemCard({
  item, items, count = 1, onUpdate, onDelete, onMove, onPromote,
  selected, onToggleSelect, onOpenItem,
}) {
  const groupItems = items ?? [item];
  const [mode, setMode] = useState(null);
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState(item.category || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const busyRef = useRef(false);
  const fieldId = useId();
  const selectable = typeof onToggleSelect === 'function';
  const isGrouped = count > 1;
  const cropped = item.image_url && item.bbox && cropStyle(item.image_url, item.bbox);

  const changeMode = (next) => {
    if (busyRef.current) return;
    setError(null);
    setMode(next);
    if (next === 'edit') {
      setEditName(item.name);
      setEditCategory(item.category || '');
    }
  };

  const runAction = async (action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      setMode(null);
    } catch (err) {
      setError(err.message || 'The change did not save. Try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const save = (event) => {
    event.preventDefault();
    if (!editName.trim()) return;
    runAction(() => onUpdate({ name: editName.trim(), category: editCategory.trim() || null }));
  };

  return (
    <article className={`card min-w-0 ${selected ? 'border-primary-500' : ''}`}>
      {mode === 'edit' ? (
        <form onSubmit={save} className="space-y-3">
          {isGrouped && <p className="text-sm text-surface-400">Changes apply to all {count} items in this group.</p>}
          <div>
            <label htmlFor={`${fieldId}-name`} className="block text-sm text-surface-300 mb-1">Name</label>
            <input id={`${fieldId}-name`} value={editName} onChange={e => setEditName(e.target.value)} maxLength={500} required autoFocus disabled={busy} className="input-field text-base" />
          </div>
          <div>
            <label htmlFor={`${fieldId}-category`} className="block text-sm text-surface-300 mb-1">Category</label>
            <input id={`${fieldId}-category`} value={editCategory} onChange={e => setEditCategory(e.target.value)} maxLength={255} disabled={busy} placeholder="For example, Electronics" className="input-field text-base" />
          </div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !editName.trim()} className="btn-primary min-h-11 flex-1">{busy ? 'Saving…' : 'Save changes'}</button>
            <button type="button" onClick={() => changeMode(null)} disabled={busy} className="btn-secondary min-h-11">Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start gap-3 min-w-0">
            {selectable && (
              <label className="flex items-center justify-center min-w-11 min-h-11 cursor-pointer">
                <input type="checkbox" checked={!!selected} onChange={onToggleSelect} className="w-5 h-5 accent-primary-500" aria-label={`Select ${item.name}`} />
              </label>
            )}
            <button
              type="button"
              onClick={selectable ? onToggleSelect : onOpenItem}
              disabled={!selectable && !onOpenItem}
              className="flex items-start gap-3 flex-1 min-w-0 text-left rounded-md"
              aria-label={selectable ? `Select ${item.name}` : `Open ${item.name}`}
            >
              {item.image_url && (cropped ? (
                <div aria-hidden="true" style={cropped} className="w-16 h-16 rounded-md border border-surface-800 shrink-0 bg-surface-900" />
              ) : (
                <img src={item.image_url} alt="" loading="lazy" className="w-16 h-16 rounded-md object-cover border border-surface-800 shrink-0" />
              ))}
              <span className="block flex-1 min-w-0">
                <span className="block text-base text-surface-100 font-medium break-words">
                  {item.name}{isGrouped && <span className="text-surface-400 font-normal ml-2">×{count}</span>}
                </span>
                {item.category && <span className="block text-sm text-surface-400 mt-1 break-words">{item.category}</span>}
                {item.confidence_score != null && item.confidence_score < 0.7 && <span className="block text-sm text-primary-400 mt-1">Check item details</span>}
              </span>
            </button>
          </div>
          {item.tags?.length > 0 && (
            <p className="text-sm text-surface-400 break-words mt-3">
              {item.tags.slice(0, 3).join(' · ')}{item.tags.length > 3 && ` · +${item.tags.length - 3}`}
            </p>
          )}
          {mode === 'delete' || mode === 'promote' ? (
            <div className="mt-4 pt-3 border-t border-surface-800 space-y-3">
              <p className="text-sm text-surface-300 break-words">
                {mode === 'delete'
                  ? isGrouped ? `Remove one of the ${count} items named “${item.name}”?` : `Delete “${item.name}” from the catalogue?`
                  : `Convert “${item.name}” to a container? You can then save items inside it.`}
              </p>
              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => runAction(mode === 'delete' ? onDelete : onPromote)} disabled={busy} className={`${mode === 'delete' ? 'btn-danger' : 'btn-primary'} min-h-11 flex-1`}>
                  {busy ? 'Saving…' : mode === 'delete' ? isGrouped ? 'Remove one' : 'Delete item' : 'Convert to container'}
                </button>
                <button type="button" onClick={() => changeMode(null)} disabled={busy} className="btn-secondary min-h-11">Cancel</button>
              </div>
            </div>
          ) : !selectable && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-surface-800">
              {onUpdate && <button type="button" onClick={() => changeMode('edit')} className="min-h-11 text-sm font-medium text-surface-300 hover:text-primary-400">Edit</button>}
              {onMove && <button type="button" onClick={e => onMove(groupItems.map(i => i.id), e)} className="min-h-11 text-sm font-medium text-surface-300 hover:text-primary-400">Move{isGrouped ? ` all ${count}` : ''}</button>}
              {!isGrouped && onPromote && <button type="button" onClick={() => changeMode('promote')} className="min-h-11 text-sm font-medium text-surface-300 hover:text-primary-400">Make container</button>}
              {onDelete && <button type="button" onClick={() => changeMode('delete')} className="min-h-11 text-sm font-medium text-surface-400 hover:text-red-400">{isGrouped ? 'Remove one' : 'Delete'}</button>}
            </div>
          )}
        </>
      )}
    </article>
  );
}
