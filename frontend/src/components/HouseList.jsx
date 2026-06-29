import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { houses as housesApi } from '../api/client';

export default function HouseList({ houses: housesProp, onUpdate }) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [error, setError] = useState(null);

  const houses = housesProp || [];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const house = await housesApi.create({
        name: newName.trim(),
        description: newDescription.trim(),
      });
      if (onUpdate) onUpdate([...houses, house]);
      setNewName('');
      setNewDescription('');
      setShowCreate(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this house and all its contents?')) return;
    try {
      await housesApi.delete(id);
      if (onUpdate) onUpdate(houses.filter(h => h.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8 animate-rise">
      {/* Hero — the catalogue cover */}
      <header className="relative overflow-hidden rounded-xl border border-surface-800 bg-surface-900 p-6 sm:p-8">
        <div className="hazard absolute inset-x-0 top-0 h-1 opacity-90" />
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="max-w-xl">
            <p className="eyebrow">Index — {new Date().getFullYear()}</p>
            <h1 className="mt-2 font-display text-4xl sm:text-5xl font-bold tracking-tight text-surface-100">
              The Home<br />Catalogue
            </h1>
            <p className="mt-3 text-surface-400 leading-relaxed">
              Photograph a shelf. The catalogue fills itself — every item identified, tagged, and filed where you'll find it.
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary self-start sm:self-auto">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New property
          </button>
        </div>
        <div className="mt-6 pt-5 border-t border-surface-800 flex items-center gap-6">
          <span className="font-mono text-2xl font-bold text-primary-500">{String(houses.length).padStart(2, '0')}</span>
          <span className="eyebrow">{houses.length === 1 ? 'Property on file' : 'Properties on file'}</span>
        </div>
      </header>

      {error && (
        <div className="card border-red-900 bg-red-950/30">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="btn-secondary mt-2 text-xs">Dismiss</button>
        </div>
      )}

      {houses.length === 0 ? (
        <div className="card text-center py-14">
          <div className="w-14 h-14 rounded-lg bg-surface-800 grid place-items-center mx-auto mb-4">
            <svg className="w-7 h-7 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-surface-200 mb-1">No properties on file</h3>
          <p className="text-surface-500 mb-5">Add a property to start cataloguing your inventory.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto">
            Add your first property
          </button>
        </div>
      ) : (
        <div>
          <p className="eyebrow mb-3">Properties</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {houses.map((house, i) => (
              <button
                key={house.id}
                onClick={() => navigate(`/houses/${house.id}`)}
                className="card group text-left hover:border-primary-500/60 hover:-translate-y-0.5
                           transition-all duration-200 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[0.7rem] text-surface-500 tracking-wider">
                    P-{String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    onClick={(e) => { e.stopPropagation(); handleDelete(house.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-surface-500 hover:text-red-400 transition-all cursor-pointer"
                    aria-label="Delete house"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </span>
                </div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <h3 className="font-display text-lg font-semibold text-surface-100 truncate">{house.name}</h3>
                </div>
                {house.description ? (
                  <p className="text-sm text-surface-500 line-clamp-2">{house.description}</p>
                ) : (
                  <p className="text-sm text-surface-600 italic">No description</p>
                )}
                <span className="mt-4 pt-3 border-t border-surface-800 font-mono text-[0.7rem] uppercase tracking-wider
                                 text-surface-500 group-hover:text-primary-500 transition-colors flex items-center gap-1.5">
                  Open property
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create house modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="card w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow mb-1">New record</p>
            <h3 className="font-display text-xl font-semibold text-surface-100 mb-4">Add a property</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block font-mono text-[0.7rem] uppercase tracking-wider text-surface-400 mb-1.5">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Main home, Lake cabin"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-mono text-[0.7rem] uppercase tracking-wider text-surface-400 mb-1.5">Description <span className="text-surface-600 normal-case tracking-normal">(optional)</span></label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="A short note about this property…"
                  className="input-field resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
