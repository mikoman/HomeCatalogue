import { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { cropStyle } from '../utils/cropStyle';

export default function ItemDetailLightbox({
  item, items, count = 1, onClose, onUpdate, onDelete, onMove, onPromote, locations = [],
}) {
  const groupItems = items ?? [item];
  const [mode, setMode] = useState(null);
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState(item.category || '');
  const [editNotes, setEditNotes] = useState(item.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const busyRef = useRef(false);
  const dialogRef = useRef(null);
  const titleId = useId();
  const isGrouped = count > 1;
  const cropped = item.image_url && item.bbox && cropStyle(item.image_url, item.bbox);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const changeMode = (next) => {
    if (busyRef.current) return;
    setMode(next);
    setError(null);
    if (next === 'edit') {
      setEditName(item.name);
      setEditCategory(item.category || '');
      setEditNotes(item.notes || '');
    }
  };

  const close = () => {
    if (busyRef.current) return;
    if (mode) changeMode(null);
    else onClose();
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
    runAction(() => onUpdate({ name: editName.trim(), category: editCategory.trim() || null, notes: editNotes.trim() }));
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}
      className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] m-auto p-0 rounded-xl bg-surface-900 text-surface-300 border border-surface-700 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <div className="relative">
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-surface-800">
          <h2 id={titleId} className="font-display text-xl font-semibold text-surface-100 break-words min-w-0 py-2">
            {mode === 'edit' ? 'Edit item' : item.name}{isGrouped && <span className="text-surface-400 font-normal ml-2">×{count}</span>}
          </h2>
          <button type="button" onClick={close} disabled={busy} className="min-w-11 min-h-11 grid place-items-center text-surface-300 hover:text-surface-100 shrink-0 rounded-md" aria-label={mode ? 'Back to item details' : 'Close item details'}>
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {item.image_url && !mode && (
          <div className="flex justify-center bg-surface-950 p-4">
            {cropped ? (
              <div role="img" aria-label={item.name} style={cropped} className="w-full max-w-xs aspect-square rounded-lg bg-surface-900" />
            ) : <img src={item.image_url} alt={item.name} className="max-h-[40dvh] max-w-full rounded-lg object-contain" />}
          </div>
        )}

        <div className="p-4 sm:p-5 space-y-4">
          {mode === 'edit' ? (
            <form onSubmit={save} className="space-y-4">
              {isGrouped && <p className="text-sm text-surface-400">Changes apply to all {count} items in this group.</p>}
              <div>
                <label htmlFor={`${titleId}-name`} className="block text-sm text-surface-300 mb-1">Name</label>
                <input id={`${titleId}-name`} value={editName} onChange={e => setEditName(e.target.value)} required maxLength={500} autoFocus disabled={busy} className="input-field text-base" />
              </div>
              <div>
                <label htmlFor={`${titleId}-category`} className="block text-sm text-surface-300 mb-1">Category</label>
                <input id={`${titleId}-category`} value={editCategory} onChange={e => setEditCategory(e.target.value)} maxLength={255} disabled={busy} placeholder="For example, Electronics" className="input-field text-base" />
              </div>
              <div>
                <label htmlFor={`${titleId}-notes`} className="block text-sm text-surface-300 mb-1">Notes</label>
                <textarea id={`${titleId}-notes`} value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} maxLength={10000} disabled={busy} placeholder="Details that help you find or identify this item" className="input-field text-base" />
              </div>
              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy || !editName.trim()} className="btn-primary min-h-11 flex-1">{busy ? 'Saving…' : 'Save changes'}</button>
                <button type="button" onClick={() => changeMode(null)} disabled={busy} className="btn-secondary min-h-11">Cancel</button>
              </div>
            </form>
          ) : mode === 'delete' || mode === 'promote' ? (
            <div className="space-y-4">
              <p className="text-surface-300 break-words">
                {mode === 'delete'
                  ? isGrouped ? `Remove one of the ${count} items named “${item.name}”?` : `Delete “${item.name}” from the catalogue?`
                  : 'This item becomes a container. You can then scan and save other items inside it.'}
              </p>
              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => runAction(mode === 'delete' ? onDelete : onPromote)} disabled={busy} className={`${mode === 'delete' ? 'btn-danger' : 'btn-primary'} min-h-11 flex-1`}>
                  {busy ? 'Saving…' : mode === 'delete' ? isGrouped ? 'Remove one' : 'Delete item' : 'Convert to container'}
                </button>
                <button type="button" onClick={() => changeMode(null)} disabled={busy} className="btn-secondary min-h-11">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {item.category && <p className="text-surface-300 break-words">{item.category}</p>}
              {locations.length > 0 && <div className="space-y-1"><p className="text-sm font-semibold text-surface-200">Location</p>{locations.map(location => <p key={location} className="text-sm text-surface-400 break-words">{location}</p>)}</div>}
              {item.tags?.length > 0 && <p className="text-sm text-surface-400 break-words">{item.tags.join(' · ')}</p>}
              {item.confidence_score != null && item.confidence_score < 0.7 && <p className="text-sm text-primary-400">The AI was uncertain. Check the name and category.</p>}
              {item.notes && <p className="text-surface-300 whitespace-pre-wrap break-words">{item.notes}</p>}
              {item.date_added && <p className="text-sm text-surface-400">Added {new Date(item.date_added).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-surface-800">
                {onUpdate && <button type="button" onClick={() => changeMode('edit')} className="btn-primary min-h-11">Edit details</button>}
                {onMove && <button type="button" onClick={() => { onClose(); onMove(groupItems.map(i => i.id)); }} className="btn-secondary min-h-11">Move{isGrouped ? ` all ${count}` : ''}</button>}
                {!isGrouped && onPromote && <button type="button" onClick={() => changeMode('promote')} className="btn-secondary min-h-11">Make container</button>}
                {onDelete && <button type="button" onClick={() => changeMode('delete')} className="btn-secondary min-h-11 text-red-400">{isGrouped ? 'Remove one' : 'Delete'}</button>}
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
