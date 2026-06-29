import { useState } from 'react';
import { createPortal } from 'react-dom';
import MovePicker from './MovePicker';

export default function ContainerTree({ containers, selectedId, onSelect, onAddChild, roomId, onMoved }) {
  const [expanded, setExpanded] = useState({});
  const [addingTo, setAddingTo] = useState(null);
  const [newName, setNewName] = useState('');
  const [moveContainerId, setMoveContainerId] = useState(null);
  const [deletingContainer, setDeletingContainer] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const getChildren = (parentId) =>
    containers.filter(c => c.parent_id === parentId);

  const handleDelete = async (containerId, deleteItems) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const { containers: containersApi } = await import('../api/client');
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
    if (!newName.trim()) return;
    try {
      const { containers: containersApi } = await import('../api/client');
      await containersApi.create({
        room_id: roomId,
        parent_id: parentId,
        name: newName.trim(),
      });
      setAddingTo(null);
      setNewName('');
      setExpanded(prev => ({ ...prev, [parentId]: true }));
    } catch (err) {
      console.error('Failed to create container:', err);
    }
  };

  const renderContainer = (container, depth = 0) => {
    const children = getChildren(container.id);
    const isExpanded = expanded[container.id];
    const isSelected = selectedId === container.id;

    return (
      <div key={container.id}>
        <div
          onClick={() => onSelect?.(container.id)}
          className={`group/row w-full min-w-0 flex items-center gap-2 px-3 py-2 rounded-md transition-colors overflow-hidden cursor-pointer ${
            isSelected
              ? 'bg-surface-800 text-primary-400'
              : 'text-surface-300 hover:bg-surface-800'
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {children.length > 0 ? (
            <svg
              className={`w-4 h-4 text-surface-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <span className="w-4" />
          )}
          <svg className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary-500' : 'text-surface-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-sm truncate min-w-0 flex-1">{container.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setMoveContainerId(container.id); }}
            className="opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 p-1 text-surface-500 hover:text-primary-400 transition-all flex-shrink-0"
            aria-label={`Move ${container.name}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m0 0l-3-3m3 3l-3 3" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeletingContainer(container); }}
            className="opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 p-1 text-surface-500 hover:text-red-400 transition-all flex-shrink-0"
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
          <div className="flex items-center gap-2 px-3 py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }}>
            {addingTo === container.id ? (
              <form onSubmit={(e) => { e.preventDefault(); handleAddChild(container.id); }} className="flex gap-1 flex-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New container…"
                  className="input-field text-sm py-1.5 flex-1"
                  autoFocus
                />
                <button type="submit" className="btn-primary text-xs px-2.5">Add</button>
                <button type="button" onClick={() => setAddingTo(null)} className="btn-secondary text-xs px-2.5">✕</button>
              </form>
            ) : (
              <button
                onClick={() => setAddingTo(container.id)}
                className="font-mono text-[0.62rem] uppercase tracking-wider text-surface-500 hover:text-primary-400 flex items-center gap-1 transition-colors"
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

  if (containers.length === 0) return null;

  return (
    <div className="space-y-0.5 min-w-0">
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
      {deletingContainer != null && createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setDeletingContainer(null)}
        >
          <div
            className="card w-full max-w-md animate-rise mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow mb-1">Delete container</p>
            <h3 className="font-display text-xl font-semibold text-surface-100 mb-2">
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
                className="btn-secondary w-full mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
