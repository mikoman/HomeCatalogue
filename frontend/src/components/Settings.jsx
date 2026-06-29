import { useState, useEffect, useCallback } from 'react';
import { aiSettings, items as itemsApi } from '../api/client';

const PROVIDERS = [
  { id: 'ollama', label: 'Ollama' },
  { id: 'lmstudio', label: 'LM Studio' },
];

export default function Settings() {
  const [provider, setProvider] = useState('ollama');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [storedUrls, setStoredUrls] = useState({ ollama: '', lmstudio: '' });
  const [storedModels, setStoredModels] = useState({ ollama: '', lmstudio: '' });
  const [storedEmbeddingModels, setStoredEmbeddingModels] = useState({ ollama: '', lmstudio: '' });
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [suggestedUrls, setSuggestedUrls] = useState({ local: '', docker: '' });
  const [suggestedUrlsByProvider, setSuggestedUrlsByProvider] = useState({});
  const [runningInDocker, setRunningInDocker] = useState(false);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [modelsError, setModelsError] = useState(null);
  const [saved, setSaved] = useState(false);

  const loadModels = useCallback(async (prov, url) => {
    if (!url?.trim()) return;
    setLoadingModels(true);
    setModelsError(null);
    try {
      const data = await aiSettings.listModels(prov, url.trim());
      setModels(data.models || []);
      if (data.error) setModelsError(data.error);
      else if ((data.models || []).length === 0) setModelsError('No models found on this server.');
    } catch (err) {
      setModels([]);
      setModelsError(err.message);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await aiSettings.get();
        if (cancelled) return;
        setProvider(data.provider);
        setBaseUrl(data.base_url);
        setModel(data.model);
        setEmbeddingModel(data.embedding_model || '');
        setStoredEmbeddingModels({
          ollama: data.ollama_embedding_model || '',
          lmstudio: data.lmstudio_embedding_model || '',
        });
        setRunningInDocker(!!data.running_in_docker);
        setSuggestedUrls(data.suggested_urls || { local: '', docker: '' });
        setSuggestedUrlsByProvider(data.suggested_urls_by_provider || {});
        setStoredUrls({
          ollama: data.ollama_base_url,
          lmstudio: data.lmstudio_base_url,
        });
        setStoredModels({
          ollama: data.ollama_model,
          lmstudio: data.lmstudio_model,
        });
        await loadModels(data.provider, data.base_url);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadModels]);

  const applySuggestedUrl = async (url) => {
    setBaseUrl(url);
    setSaved(false);
    setTestResult(null);
    await loadModels(provider, url);
  };

  const handleProviderChange = async (nextProvider) => {
    setProvider(nextProvider);
    setSaved(false);
    setTestResult(null);
    const url = storedUrls[nextProvider] || '';
    const savedModel = storedModels[nextProvider] || '';
    setBaseUrl(url);
    setModel(savedModel);
    setEmbeddingModel(storedEmbeddingModels[nextProvider] || '');
    setSuggestedUrls(suggestedUrlsByProvider[nextProvider] || { local: '', docker: '' });
    await loadModels(nextProvider, url);
  };

  const handleRefreshModels = () => loadModels(provider, baseUrl);

  const handleTestConnection = async () => {
    if (!baseUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await aiSettings.testConnection(provider, baseUrl.trim());
      setTestResult(result);
      if (result.ok && result.model_count > 0) {
        await loadModels(provider, baseUrl.trim());
      }
    } catch (err) {
      setTestResult({ ok: false, message: err.message, latency_ms: 0, model_count: 0 });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!model.trim()) {
      setError('Select a model before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await aiSettings.update({
        provider,
        base_url: baseUrl.trim(),
        model: model.trim(),
        embedding_model: embeddingModel.trim(),
      });
      setStoredUrls(prev => ({ ...prev, [provider]: baseUrl.trim() }));
      setStoredModels(prev => ({ ...prev, [provider]: model.trim() }));
      setStoredEmbeddingModels(prev => ({ ...prev, [provider]: embeddingModel.trim() }));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-surface-800 border-t-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-rise max-w-xl">
      <header>
        <p className="eyebrow">Configuration</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-surface-100 mt-1">
          AI Provider
        </h1>
        <p className="text-surface-400 mt-2">
          Choose where scan photos are analysed. Models are loaded live from your local server.
        </p>
      </header>

      {runningInDocker && (
        <div className="card border-primary-900/50 bg-primary-950/20 py-3 px-4">
          <p className="text-primary-400 text-sm font-medium">Backend is running in Docker</p>
          <p className="text-surface-400 text-xs mt-1">
            Use <code className="text-surface-300">host.docker.internal</code> to reach Ollama or LM Studio on your host machine — not <code className="text-surface-300">localhost</code>.
          </p>
        </div>
      )}

      {error && (
        <div className="card border-red-900 bg-red-950/30 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {saved && (
        <div className="card border-primary-900 bg-primary-950/20 py-3">
          <p className="text-primary-400 text-sm">Settings saved. New scans will use this provider.</p>
        </div>
      )}

      {testResult && (
        <div className={`card py-3 ${testResult.ok ? 'border-green-900 bg-green-950/20' : 'border-red-900 bg-red-950/30'}`}>
          <p className={`text-sm font-medium ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
            {testResult.ok ? 'Connection OK' : 'Connection failed'}
          </p>
          <p className="text-surface-400 text-xs mt-1">{testResult.message}</p>
          {testResult.latency_ms > 0 && (
            <p className="font-mono text-[0.62rem] text-surface-500 mt-1">
              {testResult.latency_ms}ms
              {testResult.model_count > 0 && ` · ${testResult.model_count} model(s)`}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="card space-y-5">
        <div>
          <label className="block font-mono text-[0.7rem] uppercase tracking-wider text-surface-400 mb-2">
            Provider
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProviderChange(p.id)}
                className={`px-4 py-3 rounded-md border text-left transition-colors ${
                  provider === p.id
                    ? 'border-primary-500 bg-surface-800 text-primary-400 ring-1 ring-primary-500/40'
                    : 'border-surface-700 text-surface-300 hover:border-surface-600'
                }`}
              >
                <span className="font-medium block">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-mono text-[0.7rem] uppercase tracking-wider text-surface-400 mb-1.5">
            Server URL
          </label>
          {(suggestedUrls.local || suggestedUrls.docker) && (
            <div className="flex flex-wrap gap-2 mb-2">
              {suggestedUrls.local && (
                <button
                  type="button"
                  onClick={() => applySuggestedUrl(suggestedUrls.local)}
                  className="font-mono text-[0.62rem] uppercase tracking-wider px-2.5 py-1 rounded-sm border border-surface-700 text-surface-400 hover:border-surface-600 hover:text-surface-200 transition-colors"
                >
                  Localhost
                </button>
              )}
              {suggestedUrls.docker && (
                <button
                  type="button"
                  onClick={() => applySuggestedUrl(suggestedUrls.docker)}
                  className={`font-mono text-[0.62rem] uppercase tracking-wider px-2.5 py-1 rounded-sm border transition-colors ${
                    runningInDocker
                      ? 'border-primary-500/50 text-primary-400 hover:border-primary-500'
                      : 'border-surface-700 text-surface-400 hover:border-surface-600 hover:text-surface-200'
                  }`}
                >
                  Docker host
                </button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); setSaved(false); setTestResult(null); }}
              placeholder={runningInDocker ? suggestedUrls.docker : suggestedUrls.local}
              className="input-field text-sm flex-1"
            />
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !baseUrl.trim()}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              {testing ? 'Testing…' : 'Test'}
            </button>
            <button
              type="button"
              onClick={handleRefreshModels}
              disabled={loadingModels || !baseUrl.trim()}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              {loadingModels ? 'Loading…' : 'Load models'}
            </button>
          </div>
          <p className="text-xs text-surface-500 mt-1.5">
            {runningInDocker
              ? 'From Docker, point at host.docker.internal (not localhost).'
              : 'Running locally — localhost URLs are fine.'}
          </p>
        </div>

        <div>
          <label className="block font-mono text-[0.7rem] uppercase tracking-wider text-surface-400 mb-1.5">
            Model
          </label>
          {modelsError && (
            <p className="text-xs text-amber-400 mb-2">{modelsError}</p>
          )}
          {models.length > 0 ? (
            <select
              value={model}
              onChange={(e) => { setModel(e.target.value); setSaved(false); }}
              className="input-field text-sm w-full"
            >
              <option value="">Select a model…</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => { setModel(e.target.value); setSaved(false); }}
              placeholder={provider === 'ollama' ? 'e.g. llava' : 'Model id from LM Studio'}
              className="input-field text-sm w-full"
            />
          )}
          <p className="text-xs text-surface-500 mt-1.5">
            Use a vision-capable model (e.g. llava, qwen2-vl) for photo scanning.
          </p>
        </div>

        <div className="pt-1 border-t border-surface-800 space-y-3">
          <div>
            <label className="block font-mono text-[0.7rem] uppercase tracking-wider text-surface-400 mb-1.5">
              Embedding model · semantic search
            </label>
            <input
              type="text"
              list="embed-models"
              value={embeddingModel}
              onChange={(e) => { setEmbeddingModel(e.target.value); setSaved(false); }}
              placeholder={provider === 'ollama' ? 'e.g. nomic-embed-text (optional)' : 'Embedding model id (optional)'}
              className="input-field text-sm w-full"
            />
            <datalist id="embed-models">
              {models.map(m => <option key={m.id} value={m.id} />)}
            </datalist>
            <p className="text-xs text-surface-500 mt-1.5">
              Optional. Set a text-embedding model to search by meaning (“winter gloves” finds “wool mittens”). Leave blank for keyword-only search.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={handleReindex} disabled={reindexing} className="btn-secondary text-sm">
              {reindexing ? 'Reindexing…' : 'Reindex catalogue'}
            </button>
            {reindexResult && (
              reindexResult.error
                ? <span className="text-xs text-red-400">{reindexResult.error}</span>
                : <span className="font-mono text-[0.62rem] text-surface-500">{reindexResult.embedded}/{reindexResult.total} items embedded</span>
            )}
          </div>
          <p className="text-xs text-surface-500">Save settings first, then reindex so existing items become searchable by meaning.</p>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      <div className="card border-red-900/50 bg-red-950/10 space-y-3">
        <div>
          <p className="eyebrow text-red-400">Danger zone</p>
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
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !resetting && setShowReset(false)}
        >
          <div
            className="card w-full max-w-md animate-rise border-red-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-950/50 border border-red-900/50 grid place-items-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="eyebrow text-red-400 mb-1">Irreversible</p>
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
          </div>
        </div>
      )}
    </div>
  );
}
