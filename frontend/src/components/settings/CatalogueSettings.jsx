import { useState } from 'react';
import { aiSettings, items as itemsApi } from '../../api/client';
import Modal from '../Modal';
import { Feedback } from './ProviderSettings';

export default function CatalogueSettings({ settings }) {
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);
  const handleReset = async () => {
    if (resetConfirm.trim().toUpperCase() !== 'DELETE') return;
    setResetting(true);
    setResetError(null);
    try {
      await aiSettings.resetAll();
      // Clear app-local state tied to now-deleted rooms, then hard-reload fresh.
      Object.keys(localStorage)
        .filter(k => k.startsWith('homeCatalogue:'))
        .forEach(k => localStorage.removeItem(k));
      window.location.assign('/houses');
    } catch (err) {
      setResetError(err.message);
      setResetting(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setReindexResult(null);
    try {
      const res = await itemsApi.reindexEmbeddings();
      setReindexResult(res);
    } catch (err) {
      setReindexResult({ error: err.message });
    } finally {
      setReindexing(false);
    }
  };


  const active = settings.providers[settings.provider];
  return <div className="space-y-8 max-w-3xl">
    <section className="card !p-5 sm:!p-6 space-y-4">
      <h2 className="text-xl font-semibold text-surface-100">Search by meaning</h2>
      <p className="text-sm text-surface-400">Set an embedding model for your active local provider, then reindex existing items.</p>
      <p className="text-sm text-surface-300 break-words">{active.embedding_model ? `Active embedding model: ${active.embedding_model}` : 'No embedding model is active. Keyword search remains available.'}</p>
      <button type="button" className="btn-primary text-sm" disabled={reindexing || !active.embedding_model} onClick={handleReindex}>{reindexing ? 'Reindexing…' : 'Reindex catalogue'}</button>
      <Feedback result={reindexResult && { ok: !reindexResult.error, message: reindexResult.error || `${reindexResult.embedded} of ${reindexResult.total} items indexed.` }} />
    </section>
    <section className="card !p-5 sm:!p-6 space-y-3">
      <h2 className="text-xl font-semibold text-surface-100">Backend storage</h2>
      <p className="text-sm text-surface-400">The backend saves provider settings and keys in its runtime settings file. Changes apply without a restart.</p>
      <p className="text-sm text-surface-400">The file uses owner-only permissions. It contains unencrypted keys. Protect the storage directory and its backups.</p>
      <p className="text-sm text-surface-400">Use this app on a trusted network. It has no sign-in. Anyone with access can change settings or use configured providers.</p>
      <a href="/api/health" target="_blank" rel="noreferrer" className="inline-block text-sm text-primary-400 underline py-2">View backend health</a>
    </section>
      <div className="card border-red-900/50 bg-red-950/10 space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-surface-100 mt-1">Reset catalogue</h2>
          <p className="text-sm text-surface-400 mt-1">
            Permanently delete every house, room, container, item, and uploaded image so you can start from scratch. Your AI provider settings are kept. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setResetConfirm(''); setResetError(null); setShowReset(true); }}
          className="btn-danger text-sm"
        >
          Delete everything
        </button>
      </div>

      {showReset && (
        <Modal labelledBy="reset-title" busy={resetting} onClose={() => setShowReset(false)} className="border-red-900">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-950/50 border border-red-900/50 grid place-items-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 id="reset-title" className="font-display text-xl font-semibold text-surface-100">
                  Delete everything?
                </h3>
              </div>
            </div>

            <p className="text-sm text-surface-400 mb-4">
              This removes <strong className="text-surface-200">all</strong> houses, rooms, containers, items, scan history, and uploaded photos. There is no undo. Type <code className="text-surface-200">DELETE</code> to confirm.
            </p>

            {resetError && (
              <div className="card border-red-900 bg-red-950/30 mb-4 py-2.5 px-3">
                <p className="text-red-400 text-sm">{resetError}</p>
              </div>
            )}

            <input
              type="text"
              aria-label="Type DELETE to confirm"
              disabled={resetting}
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="DELETE"
              className="input-field text-sm mb-4"
              autoFocus
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting || resetConfirm.trim().toUpperCase() !== 'DELETE'}
                className="btn-danger flex-1 order-1 sm:order-2"
              >
                {resetting ? 'Deleting…' : 'Delete everything'}
              </button>
              <button
                type="button"
                onClick={() => setShowReset(false)}
                disabled={resetting}
                className="btn-secondary flex-1 order-2 sm:order-1"
              >
                Cancel
              </button>
            </div>
        </Modal>
      )}
  </div>;
}
