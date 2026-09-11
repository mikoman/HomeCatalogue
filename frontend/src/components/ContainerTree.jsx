import { useState, useEffect } from 'react';
import MovePicker from './MovePicker';
import { containers as containersApi } from '../api/client';
import Icon from './Icon';
import Modal from './Modal';

export default function ContainerTree({ containers, selectedId, onSelect, onAddChild, roomId, onMoved }) {
  const [expanded, setExpanded] = useState({});
  const [addingTo, setAddingTo] = useState(null);
  const [newName, setNewName] = useState('');
  const [moveContainerId, setMoveContainerId] = useState(null);
  const [deletingContainer, setDeletingContainer] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const ancestors = {};
    const visited = new Set();
    let current = containers.find(container => container.id === selectedId);
    while (current?.parent_id && !visited.has(current.parent_id)) {
      visited.add(current.parent_id);
      ancestors[current.parent_id] = true;
      current = containers.find(container => container.id === current.parent_id);
    }
    setExpanded(previous => ({ ...previous, ...ancestors }));
  }, [selectedId, containers]);

  const getChildren = (parentId) =>
    containers.filter(c => c.parent_id === parentId);

  const handleDelete = async (containerId, deleteItems) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await containersApi.delete(containerId, { deleteItems });
      setDeletingContainer(null);
      onMoved?.();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddChild = async (parentId) => {
    if (!newName.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      await containersApi.create({
        room_id: roomId,
        parent_id: parentId,
        name: newName.trim(),
      });
      setAddingTo(null);
      setNewName('');
      setExpanded(prev => ({ ...prev, [parentId]: true }));
      onMoved?.();
    } catch (err) {
      setAddError(err.message);
    } finally { setAdding(false); }
  };

  const renderContainer = (container, depth = 0) => {
    const children = getChildren(container.id);
    const isExpanded = expanded[container.id];
    const isSelected = selectedId === container.id;

    return (
      <div key={container.id}>
        <div
          className={`group/row w-full min-w-0 flex items-center gap-2 px-3 py-2 rounded-md transition-colors overflow-hidden cursor-pointer ${
            isSelected
              ? 'bg-surface-800 text-primary-400'
              : 'text-surface-300 hover:bg-surface-800'
          }`}
          style={{ paddingLeft: `${Math.min(depth, 4) * 12 + 4}px` }}
        >
          <button type="button" className="shrink-0 min-w-8 min-h-11 grid place-items-center" onClick={() => setExpanded(previous => ({ ...previous, [container.id]: !isExpanded }))} aria-expanded={!!isExpanded} aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${container.name}`}>
            <svg
              className={`w-4 h-4 text-surface-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <svg className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary-500' : 'text-surface-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <button type="button" className="text-sm text-left truncate min-w-0 flex-1 min-h-11" onClick={() => onSelect?.(container.id)} aria-pressed={isSelected}>{container.name}</button>
          <button
            onClick={(e) => { e.stopPropagation(); setMoveContainerId(container.id); }}
            className="min-w-9 min-h-11 grid place-items-center text-surface-400 hover:text-primary-400 flex-shrink-0"
            aria-label={`Move ${container.name}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m0 0l-3-3m3 3l-3 3" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeletingContainer(container); }}
            className="min-w-9 min-h-11 grid place-items-center text-surface-400 hover:text-red-400 flex-shrink-0"
            aria-label={`Delete ${container.name}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {isExpanded && children.length > 0 && (
          <div className="space-y-0.5">
            {children.map(child => renderContainer(child, depth + 1))}
          </div>
        )}

        {isExpanded && (
          <div className="flex items-center gap-2 px-3 py-1" style={{ paddingLeft: `${Math.min(depth + 1, 4) * 12 + 4}px` }}>
            {addingTo === container.id ? (
              <form onSubmit={(e) => { e.preventDefault(); handleAddChild(container.id); }} className="flex gap-1 flex-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New container…"
                  aria-label="New container name"
                  maxLength={255}
                  disabled={adding}
                  className="input-field text-sm py-1.5 flex-1"
                  autoFocus
                />
                <button type="submit" disabled={adding || !newName.trim()} className="btn-primary text-xs px-2.5">{adding ? 'Saving…' : 'Add'}</button>
                <button type="button" disabled={adding} onClick={() => setAddingTo(null)} className="btn-secondary text-xs px-2.5" aria-label="Cancel new container"><Icon name="close" className="w-4 h-4" /></button>
              </form>
            ) : (
              <button
                onClick={() => { setAddingTo(container.id); setAddError(null); }}
                className="min-h-11 text-sm text-surface-400 hover:text-primary-400 flex items-center gap-2 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add sub-container
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Root containers (no parent)
  const rootContainers = getChildren(null);

  if (containers.length === 0) return null;

  return (
    <div className="space-y-0.5 min-w-0">
      {addError && <p role="alert" className="text-sm text-red-300 px-3 py-2">{addError}</p>}
      {rootContainers.map(container => renderContainer(container))}
      {moveContainerId != null && (
        <MovePicker
          sourceRoomId={parseInt(roomId)}
          mode="container"
          containerId={moveContainerId}
          onDone={() => { onMoved?.(); setMoveContainerId(null); }}
          onClose={() => setMoveContainerId(null)}
        />
      )}
      {deletingContainer != null && (
        <Modal labelledBy="delete-container-title" busy={deleting} onClose={() => setDeletingContainer(null)}>
            <h3 id="delete-container-title" className="font-display text-xl font-semibold text-surface-100 mb-2">
              Delete “{deletingContainer.name}”?
            </h3>
            <p className="text-sm text-surface-400 mb-4">
              This removes the container and any sub-containers inside it. Choose what happens to the items filed there.
            </p>

            {deleteError && (
              <div className="card border-red-900 bg-red-950/30 mb-4 py-2.5 px-3">
                <p className="text-red-400 text-sm">{deleteError}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleDelete(deletingContainer.id, false)}
                disabled={deleting}
                className="btn-secondary w-full text-left"
              >
                Delete container only
                <span className="block text-xs font-normal text-surface-500 mt-0.5">
                  Items stay in this room, filed loose.
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingContainer.id, true)}
                disabled={deleting}
                className="w-full px-4 py-2.5 rounded-md bg-red-950/50 text-red-400 border border-red-900 hover:bg-red-950 transition-colors text-left disabled:opacity-50"
              >
                Delete container &amp; items
                <span className="block text-xs font-normal text-red-400/70 mt-0.5">
                  Permanently remove all items inside.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDeletingContainer(null)}
                disabled={deleting}
                autoFocus
                className="btn-secondary w-full mt-1"
              >
                Cancel
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
