import { useState } from 'react';

export default function ContainerTree({ containers, selectedId, onSelect, onAddChild, roomId }) {
  const [expanded, setExpanded] = useState({});
  const [addingTo, setAddingTo] = useState(null);
  const [newName, setNewName] = useState('');

  const getChildren = (parentId) =>
    containers.filter(c => c.parent_id === parentId);

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddChild = async (parentId) => {
    if (!newName.trim()) return;
    try {
      const { containers: containersApi } = await import('../api/client');
      const container = await containersApi.create({
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
        <button
          onClick={() => onSelect?.(container.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
            isSelected
              ? 'bg-primary-900/30 text-primary-400 border border-primary-800'
              : 'text-surface-300 hover:bg-surface-800'
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {children.length > 0 && (
            <svg
              className={`w-4 h-4 text-surface-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {children.length === 0 && <span className="w-4" />}
          <svg className="w-4 h-4 text-surface-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-sm truncate">{container.name}</span>
        </button>

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
                  placeholder="New container..."
                  className="input-field text-sm py-1.5 flex-1"
                  autoFocus
                />
                <button type="submit" className="btn-primary text-xs px-2">Add</button>
                <button type="button" onClick={() => setAddingTo(null)} className="btn-secondary text-xs px-2">✕</button>
              </form>
            ) : (
              <button
                onClick={() => setAddingTo(container.id)}
                className="text-xs text-surface-500 hover:text-surface-300 flex items-center gap-1"
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
    <div className="space-y-1">
      {rootContainers.map(container => renderContainer(container))}
    </div>
  );
}
