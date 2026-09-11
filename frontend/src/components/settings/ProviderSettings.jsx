import { useEffect, useRef, useState } from 'react';
import { aiSettings } from '../../api/client';
import { PROVIDERS, createDraft, connectionPayload, providerPayload, isDirty, filterModels } from '../../utils/settings-draft';
import DeepSeekSettings from './DeepSeekSettings';

export function Feedback({ result }) {
  if (!result) return null;
  return <div role={result.ok ? 'status' : 'alert'} className={`rounded-md border px-4 py-3 text-sm ${result.ok ? 'border-green-900 text-green-300 bg-green-950/20' : 'border-red-900 text-red-300 bg-red-950/20'}`}>
    <p>{result.message}</p>
    {result.latency_ms > 0 && <p className="mt-1 text-xs tabular-nums">Response time: {result.latency_ms} ms</p>}
  </div>;
}

export default function ProviderSettings({ settings, onSaved, onDirty }) {
  const [provider, setProvider] = useState(settings.provider);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(PROVIDERS.map(p => [p.id, createDraft(settings.providers[p.id])])));
  const [models, setModels] = useState([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackFor, setFeedbackFor] = useState('connection');
  const [showKey, setShowKey] = useState(false);
  const request = useRef({ sequence: 0, controller: null });
  const current = PROVIDERS.find(p => p.id === provider);
  const draft = drafts[provider];
  const stored = settings.providers[provider];
  const dirty = isDirty(draft, stored);
  const filteredModels = filterModels(models, query);
  const suggestions = settings.suggested_urls_by_provider[provider] || {};
  const anyDirty = PROVIDERS.some(p => isDirty(drafts[p.id], settings.providers[p.id]));

  useEffect(() => { onDirty(anyDirty); }, [anyDirty, onDirty]);
  useEffect(() => () => { request.current.sequence += 1; request.current.controller?.abort(); }, []);

  function invalidate() {
    request.current.sequence += 1;
    request.current.controller?.abort();
    setBusy('');
    setFeedback(null);
  }

  function edit(field, value) {
    invalidate();
    setDrafts(previous => ({ ...previous, [provider]: { ...previous[provider], [field]: value } }));
    if (['base_url', 'api_key', 'api_key_action'].includes(field)) {
      setModels([]);
      setLoaded(false);
      setQuery('');
    }
  }

  function selectProvider(id) {
    invalidate();
    setProvider(id);
    setModels([]);
    setLoaded(false);
    setQuery('');
    setShowKey(false);
  }

  async function connect(action) {
    invalidate();
    const sequence = request.current.sequence;
    const controller = new AbortController();
    request.current.controller = controller;
    const payload = connectionPayload(provider, draft);
    setBusy(action);
    setFeedbackFor('connection');
    try {
      if (action === 'test') {
        const result = await aiSettings.testConnection(payload, controller.signal);
        if (sequence !== request.current.sequence) return;
        setFeedback(result);
        if (!result.ok) return;
      }
      const result = await aiSettings.listModels(payload, controller.signal);
      if (sequence !== request.current.sequence) return;
      setModels(result.models || []);
      setLoaded(!result.error);
      if (result.error) setFeedback({ ok: false, message: result.error });
      else if (action !== 'test') setFeedback({ ok: true, message: `${result.models.length} models loaded. Select a vision model or enter its ID.` });
    } catch (error) {
      if (sequence === request.current.sequence && error.name !== 'AbortError') setFeedback({ ok: false, message: error.message });
    } finally {
      if (sequence === request.current.sequence) setBusy('');
    }
  }

  async function save(activate) {
    if (saving) return;
    invalidate();
    setSaving(true);
    setFeedbackFor('save');
    try {
      const result = await aiSettings.update(providerPayload(provider, draft, activate));
      onSaved(result);
      setDrafts(previous => ({ ...previous, [provider]: createDraft(result.providers[provider]) }));
      setShowKey(false);
      setFeedback({ ok: true, message: activate ? `${current.label} is saved. New scans use this provider.` : 'Provider saved. The active provider did not change.' });
    } catch (error) {
      setFeedback({ ok: false, message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
    <aside aria-label="Inference providers" className="min-w-0">
      <h2 className="text-lg font-semibold text-surface-100 mb-3">Provider</h2>
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
        {PROVIDERS.map(p => <button type="button" key={p.id} aria-pressed={p.id === provider} disabled={saving}
          onClick={() => selectProvider(p.id)}
          className={`min-w-0 rounded-md px-3 py-3 text-left border transition-colors ${p.id === provider ? 'border-primary-500 text-primary-400 bg-surface-800' : 'border-transparent text-surface-300 hover:bg-surface-900'}`}>
          <span className="flex flex-wrap items-center gap-2 font-medium">{p.label}{p.id === settings.provider && <span className="text-xs text-surface-300">Active</span>}</span>
          <span className="block text-xs text-surface-400 mt-1">{p.hint}{isDirty(drafts[p.id], settings.providers[p.id]) ? ' · Edited' : ''}</span>
        </button>)}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-surface-400">Each provider keeps its own model, URL, and key. Selecting a provider here does not change new scans.</p>
    </aside>

    <form className="card !p-5 sm:!p-6 space-y-6" onSubmit={event => { event.preventDefault(); save(true); }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-surface-100">Set up {current.label}</h2>
          <p className="mt-1 text-sm text-surface-400">{current.local ? 'Connect your model server, then select a vision model.' : 'Enter your API key, then load the available models.'}</p>
        </div>
        <span className={`text-xs py-1 ${dirty ? 'text-primary-400' : 'text-surface-400'}`}>{dirty ? 'Unsaved changes' : 'Saved configuration'}</span>
      </div>
      {!current.local && <p className="text-sm text-surface-300">Cloud scans send photos and container context to this provider. Charges can apply.</p>}
      <fieldset disabled={saving} className="space-y-5 min-w-0">
        <div>
          <label htmlFor="provider-url" className="field-label">Server URL</label>
          <input id="provider-url" type="url" required readOnly={!current.local} value={draft.base_url} onChange={event => edit('base_url', event.target.value)}
            className="input-field text-sm" autoComplete="off" spellCheck={false} aria-describedby="provider-url-help" />
          <p id="provider-url-help" className="text-xs text-surface-400 mt-2">{current.local
            ? `${provider === 'ollama' ? 'Use the server address without /api.' : 'Include /v1 for this OpenAI-compatible server.'} ${settings.running_in_docker ? 'The backend runs in Docker. Use the Docker host address for a server on this machine.' : 'Use localhost for a server on this machine.'}`
            : 'The official HTTPS endpoint is fixed to protect your API key.'}</p>
          {current.local && <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(suggestions).filter(([, value]) => value).map(([name, url]) => <button key={name} type="button" className="btn-secondary text-xs !min-h-10 !py-2"
              onClick={() => edit('base_url', url)}>{name === 'docker' ? 'Use Docker host' : 'Use localhost'}</button>)}
          </div>}
          {current.local && stored.api_key_configured && draft.base_url.replace(/\/$/, '') !== stored.base_url.replace(/\/$/, '') &&
            <p className="text-sm text-primary-300 mt-2">The URL changed. Enter a key for this server if it requires one.</p>}
        </div>
        <div>
          <div className="flex flex-wrap justify-between gap-2 mb-2">
            <label htmlFor="provider-key" className="text-sm font-medium text-surface-300">API key{current.local ? ' (optional)' : ''}</label>
            <span className="text-xs text-surface-400">{stored.api_key_configured ? `Key available from ${stored.api_key_source === 'saved' ? 'saved settings' : 'the environment'}` : 'No key configured'}</span>
          </div>
          <div className="flex gap-2">
            <input id="provider-key" type={showKey ? 'text' : 'password'} value={draft.api_key} disabled={draft.api_key_action !== 'keep'}
              onChange={event => edit('api_key', event.target.value)} className="input-field min-w-0 text-sm" autoComplete="new-password" spellCheck={false}
              placeholder={stored.api_key_configured ? 'Enter a replacement key' : 'Paste an API key'} aria-describedby="provider-key-help" />
            <button type="button" aria-label={showKey ? 'Hide API key' : 'Show API key'} aria-pressed={showKey} onClick={() => setShowKey(!showKey)} className="btn-secondary text-sm">{showKey ? 'Hide' : 'Show'}</button>
          </div>
          <p id="provider-key-help" className="text-xs text-surface-400 mt-2">A blank field keeps the current key. Saved keys stay on the backend and do not return to this page.</p>
          <div className="flex flex-wrap items-end gap-3 mt-3">
            <div className="flex-1 min-w-0">
              <label htmlFor="key-action" className="field-label text-xs">Key action when saving</label>
              <select id="key-action" className="input-field text-sm" value={draft.api_key_action} onChange={event => { edit('api_key_action', event.target.value); setShowKey(false); }}>
                <option value="keep">Keep or replace key</option>
                <option value="clear">Remove key</option>
                {stored.environment_key_available && <option value="environment">Use environment key</option>}
              </select>
            </div>
            {current.keyUrl && <a href={current.keyUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-400 underline py-3">Create an API key</a>}
          </div>
          {draft.api_key_action === 'clear' && <p className="text-sm text-primary-300 mt-2">Save the provider to remove its key and disable its environment key. Cloud scans require a key.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => connect('test')} disabled={!!busy || !draft.base_url.trim()} className="btn-secondary text-sm">{busy === 'test' ? 'Testing connection…' : 'Test connection'}</button>
          <button type="button" onClick={() => connect('models')} disabled={!!busy || !draft.base_url.trim()} className="btn-secondary text-sm">{busy === 'models' ? 'Loading models…' : 'Load models'}</button>
        </div>
        {feedbackFor === 'connection' && <Feedback result={feedback} />}
        <div className="border-t border-surface-800 pt-5 space-y-3">
          <div>
            <label htmlFor="vision-model" className="field-label">Vision model</label>
            <input id="vision-model" className="input-field text-sm" required maxLength={255} value={draft.model} onChange={event => edit('model', event.target.value)}
              placeholder={current.example} autoComplete="off" spellCheck={false} />
            <p className="text-xs text-surface-400 mt-2">Enter a model ID, or select a model from the list below.</p>
          </div>
          {loaded && <div>
            {models.length > 0 ? <>
              <label htmlFor="model-search" className="field-label text-xs">Search available models</label>
              <input id="model-search" type="search" className="input-field text-sm" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by model name or ID" />
              <div className="max-h-52 overflow-y-auto mt-2 rounded-md border border-surface-700 divide-y divide-surface-800" aria-label="Available models">
                {filteredModels.map(model => <button type="button" key={model.id} aria-pressed={model.id === draft.model} onClick={() => edit('model', model.id)}
                  className={`block w-full min-h-11 px-3 py-2 text-left text-sm break-words hover:bg-surface-800 ${model.id === draft.model ? 'text-primary-400 bg-surface-800' : 'text-surface-300'}`}>
                  {model.name}{model.name !== model.id && <span className="block text-xs text-surface-400">{model.id}</span>}
                </button>)}
                {!filteredModels.length && <p className="p-3 text-sm text-surface-400">No models match this search. You can enter the model ID above.</p>}
              </div>
            </> : <p className="text-sm text-surface-400">{provider === 'deepseek' ? 'DeepSeek listed no supported vision models. Check model availability in your account.' : 'The server returned no models. Install or load a vision model in your model server.'}</p>}
            <p className="text-xs text-surface-400 mt-2">{provider === 'deepseek' ? 'This list includes the documented Flash vision models. Use deepseek-flash for new scans.' : provider === 'openrouter' ? 'This list includes image models that advertise structured output.' : 'This list can include text and embedding models. Select a model that accepts images.'}</p>
          </div>}
          {current.local && <details className="text-sm text-surface-300">
            <summary className="cursor-pointer py-2">Model guidance for 32 GB RAM</summary>
            <div className="space-y-2 text-surface-400 pt-2">
              <p>Start with Qwen3.5 9B at 4-bit precision. Compare Qwen3.8 27B at 4-bit precision when more memory is available.</p>
              <p>For Ollama, use <code>qwen3.5:9b</code>, <code>qwen3.8:27b</code>, or <code>qwen3-vl:8b</code> for grounding tests.</p>
              <p>LM Studio and oMLX use their server model IDs. Install the model in its server before scanning.</p>
              <p>Start with one scan at a time. Model downloads exclude runtime memory.</p>
            </div>
          </details>}
        </div>
        {provider === 'deepseek' && <DeepSeekSettings value={draft.deepseek} onChange={value => edit('deepseek', value)} />}
        {current.local && <div className="border-t border-surface-800 pt-5">
          <label htmlFor="embedding-model" className="field-label">Embedding model (optional)</label>
          <input id="embedding-model" value={draft.embedding_model} maxLength={255} onChange={event => edit('embedding_model', event.target.value)} className="input-field text-sm" placeholder="Text embedding model ID" />
          <p className="text-xs text-surface-400 mt-2">This model enables search by meaning. Leave the field blank for keyword search. Save, then reindex under Catalogue data.</p>
        </div>}
        <div className="border-t border-surface-800 pt-5 flex flex-wrap gap-2">
          <button type="submit" className="btn-primary text-sm" disabled={!draft.model.trim() || busy !== ''}>{saving ? 'Saving…' : 'Save and use provider'}</button>
          <button type="button" onClick={() => save(false)} className="btn-secondary text-sm" disabled={!draft.model.trim() || busy !== ''}>Save provider only</button>
          {dirty && <button type="button" className="btn-secondary text-sm" onClick={() => { invalidate(); setDrafts(previous => ({ ...previous, [provider]: createDraft(stored) })); setShowKey(false); setLoaded(false); }}>Discard edits</button>}
        </div>
        <p className="text-xs text-surface-400">Saving the active provider updates new scans. Tests check the connection and model list, not image inference.</p>
      </fieldset>
      {feedbackFor === 'save' && <Feedback result={feedback} />}
    </form>
  </div>;
}
