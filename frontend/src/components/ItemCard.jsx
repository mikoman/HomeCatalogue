import { useState } from 'react';

export default function ItemCard({ item, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState(item.category || '');
  const [showDelete, setShowDelete] = useState(false);

  const handleSave = async () => {
    if (!editName.trim()) return;
    await onUpdate({
      name: editName.trim(),
      category: editCategory.trim() || null,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await onDelete();
  };

  const getConfidenceBadge = () => {
    if (item.confidence_score === null || item.confidence_score >= 0.9) return null;
    if (item.confidence_score >= 0.7) return <span className="badge-medium">AI: {Math.round(item.confidence_score * 100)}%</span>;
    return <span className="badge-low">AI: {Math.round(item.confidence_score * 100)}%</span>;
  };

  if (isEditing) {
    return (
      <div className="card">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-surface-500 mb-1">Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input-field text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-surface-500 mb-1">Category</label>
            <input
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              placeholder="e.g., Electronics, Food"
              className="input-field text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary text-sm flex-1">Save</button>
            <button onClick={() => setIsEditing(false)} className="btn-secondary text-sm flex-1">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card group hover:border-surface-700 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-surface-100 font-medium truncate">{item.name}</h3>
          {item.category && (
            <span className="inline-block mt-1 badge bg-surface-800 text-surface-400">
              {item.category}
            </span>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs text-surface-500">#{tag}</span>
              ))}
              {item.tags.length > 3 && (
                <span className="text-xs text-surface-600">+{item.tags.length - 3}</span>
              )}
            </div>
          )}
          {getConfidenceBadge()}
          {item.date_added && (
            <p className="text-xs text-surface-600 mt-2">
              Added {new Date(item.date_added).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsEditing(true)}
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
        </div>
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="mt-3 pt-3 border-t border-surface-800">
          <p className="text-sm text-surface-400 mb-2">Delete this item?</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} className="btn-danger text-xs px-3 py-1.5">Delete</button>
            <button onClick={() => setShowDelete(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
