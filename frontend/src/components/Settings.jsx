import { useCallback, useEffect, useState } from 'react';
import { aiSettings } from '../api/client';
import { PROVIDERS } from '../utils/settings-draft';
import ProviderSettings, { Feedback } from './settings/ProviderSettings';
import ScanSettings from './settings/ScanSettings';
import CatalogueSettings from './settings/CatalogueSettings';

const SECTIONS = [
  { id: 'providers', label: 'Providers and models' },
  { id: 'scans', label: 'Scans and boxes' },
  { id: 'catalogue', label: 'Catalogue data' },
];

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [section, setSection] = useState('providers');
  const [providerDirty, setProviderDirty] = useState(false);
  const [scanDirty, setScanDirty] = useState(false);
  const updateProviderDirty = useCallback(value => setProviderDirty(value), []);
  const updateScanDirty = useCallback(value => setScanDirty(value), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    aiSettings.get().then(data => { if (!cancelled) setSettings(data); })
      .catch(failure => { if (!cancelled) setError(failure.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    if (!providerDirty && !scanDirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [providerDirty, scanDirty]);

  if (loading) return <p role="status" className="py-12 text-surface-400">Loading backend settings…</p>;
  if (!settings) return <div className="max-w-xl space-y-4"><h1 className="text-3xl font-bold text-surface-100">Backend settings</h1><Feedback result={{ ok: false, message: error || 'Cannot load settings.' }} /><button className="btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>;
  const active = PROVIDERS.find(provider => provider.id === settings.provider);
  const needsKey = !active.local && !settings.providers[active.id].api_key_configured;

  return <div className="max-w-5xl space-y-6">
    <header>
      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-surface-100">Backend settings</h1>
      <p className="text-surface-400 mt-2 max-w-2xl">Connect a vision model, choose how scans work, and manage catalogue search.</p>
    </header>
    <div className="flex flex-wrap justify-between gap-3 border-y border-surface-800 py-4">
      <div className="min-w-0"><p className="text-xs text-surface-400 mb-1">New scans use</p><p className="text-sm text-surface-100 break-words"><strong>{active.label}</strong><span className="text-surface-400"> · {settings.effective_model || 'No model selected'}</span></p></div>
      <div className="text-sm text-surface-400 sm:text-right"><p>{settings.running_in_docker ? 'Backend in Docker' : 'Backend runs directly'}</p><p className={`text-xs mt-1 ${needsKey ? 'text-red-400' : 'text-surface-400'}`}>{needsKey ? 'An API key is required' : settings.box_source === 'off' ? 'Bounding boxes off' : settings.box_source === 'vlm' ? 'Boxes from the vision model' : 'Boxes from the object detector'}</p></div>
    </div>
    <nav aria-label="Settings sections" className="flex flex-wrap gap-2 border-b border-surface-800 pb-3">
      {SECTIONS.map(entry => <button type="button" key={entry.id} aria-pressed={section === entry.id} aria-controls={`settings-${entry.id}`} onClick={() => setSection(entry.id)}
        className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors ${section === entry.id ? 'bg-primary-500 text-surface-950' : 'text-surface-300 hover:bg-surface-800'}`}>
        {entry.label}{((entry.id === 'providers' && providerDirty) || (entry.id === 'scans' && scanDirty)) && <span className="sr-only">, unsaved changes</span>}
      </button>)}
    </nav>
    {(providerDirty || scanDirty) && <p className="text-sm text-primary-300" role="status">You have unsaved changes. Save each edited section before leaving Settings.</p>}
    <section id="settings-providers" aria-label="Providers and models" hidden={section !== 'providers'}><ProviderSettings settings={settings} onSaved={setSettings} onDirty={updateProviderDirty} /></section>
    <section id="settings-scans" aria-label="Scans and boxes" hidden={section !== 'scans'}><ScanSettings settings={settings} onSaved={setSettings} onDirty={updateScanDirty} /></section>
    <section id="settings-catalogue" aria-label="Catalogue data" hidden={section !== 'catalogue'}><CatalogueSettings settings={settings} /></section>
  </div>;
}
