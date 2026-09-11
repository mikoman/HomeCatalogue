import { useEffect, useRef, useState } from 'react';
import { aiSettings, detector } from '../../api/client';
import { Feedback } from './ProviderSettings';

const FIELDS = [
  { id: 'scan_max_edge', label: 'Maximum image edge', unit: 'pixels', min: 256, max: 4096, help: 'The backend resizes the photo before inference. Larger images can improve small objects and use more memory.' },
  { id: 'scan_max_tokens', label: 'Maximum output', unit: 'tokens', min: 256, max: 32768, help: 'Increase this limit if the model truncates an inventory. DeepSeek uses its own output limit under Providers and models.' },
  { id: 'ollama_num_ctx', label: 'Ollama context', unit: 'tokens', min: 2048, max: 131072, help: 'This limit applies to Ollama. Configure context in LM Studio or oMLX on its model server.' },
];
const MODES = [
  { id: 'off', label: 'No boxes', description: 'Identify items without outlines on the photo.' },
  { id: 'vlm', label: 'Vision model', description: 'Use the selected vision model for item names and estimated boxes.' },
  { id: 'yolo', label: 'Object detector', description: 'Use a YOLOE or YOLO-World server for boxes after item classification.' },
];

export default function ScanSettings({ settings, onSaved, onDirty }) {
  const [scan, setScan] = useState(settings.scan);
  const [source, setSource] = useState(settings.box_source);
  const [url, setUrl] = useState(settings.detector_base_url);
  const [scanBusy, setScanBusy] = useState(false);
  const [detectorBusy, setDetectorBusy] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [detectorResult, setDetectorResult] = useState(null);
  const sequence = useRef(0);
  const dirty = FIELDS.some(field => String(scan[field.id]) !== String(settings.scan[field.id]))
    || source !== settings.box_source || url !== settings.detector_base_url;
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => () => { sequence.current += 1; }, []);

  function editDetector(nextSource, nextUrl) {
    sequence.current += 1;
    setSource(nextSource);
    setUrl(nextUrl);
    setDetectorResult(null);
    setDetectorBusy('');
  }

  async function saveScan(event) {
    event.preventDefault();
    if (scanBusy) return;
    setScanBusy(true);
    setScanResult(null);
    try {
      const result = await aiSettings.updateScan(Object.fromEntries(FIELDS.map(field => [field.id, Number(scan[field.id])])));
      onSaved(result);
      setScan(result.scan);
      setScanResult({ ok: true, message: 'Scan limits saved. New scans use these values.' });
    } catch (error) {
      setScanResult({ ok: false, message: error.message });
    } finally { setScanBusy(false); }
  }

  async function detectorAction(action) {
    const request = ++sequence.current;
    setDetectorBusy(action);
    setDetectorResult(null);
    try {
      const result = action === 'test' ? await detector.test(url.trim()) : await detector.update({ box_source: source, base_url: url.trim() });
      if (request !== sequence.current) return;
      if (action === 'save') {
        onSaved(result);
        setUrl(result.detector_base_url);
        setDetectorResult({ ok: true, message: 'Detection settings saved. New scans use this mode.' });
      } else setDetectorResult(result);
    } catch (error) {
      if (request === sequence.current) setDetectorResult({ ok: false, message: error.message });
    } finally {
      if (request === sequence.current) setDetectorBusy('');
    }
  }

  return <div className="space-y-8 max-w-3xl">
    <form onSubmit={event => { event.preventDefault(); detectorAction('save'); }} className="card !p-5 sm:!p-6 space-y-5">
      <div><h2 className="text-xl text-surface-100 font-semibold">Bounding boxes</h2><p className="mt-2 text-sm text-surface-400">Select how the app outlines items on a photo.</p></div>
      <fieldset disabled={detectorBusy === 'save'} className="space-y-3">
        <legend className="sr-only">Box source</legend>
        {MODES.map(mode => <label key={mode.id} className={`flex gap-3 items-start p-3 border rounded-md cursor-pointer ${source === mode.id ? 'border-primary-500 bg-surface-800' : 'border-surface-700 hover:bg-surface-800'}`}>
          <input type="radio" name="box-source" value={mode.id} checked={source === mode.id} onChange={() => editDetector(mode.id, url)} className="mt-1 accent-primary-500 w-4 h-4 shrink-0" />
          <span><span className="text-sm font-medium text-surface-100">{mode.label}</span><span className="block text-sm text-surface-400 mt-1">{mode.description}</span></span>
        </label>)}
        {source === 'yolo' && <div className="pt-3 space-y-3">
          <div><label htmlFor="detector-url" className="field-label">Detector URL</label>
            <input id="detector-url" type="url" required value={url} onChange={event => editDetector(source, event.target.value)} className="input-field text-sm" placeholder="http://localhost:8077" /></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => editDetector(source, settings.running_in_docker ? 'http://host.docker.internal:8077' : 'http://localhost:8077')}>Use suggested address</button>
            <button type="button" disabled={!!detectorBusy || !url.trim()} onClick={() => detectorAction('test')} className="btn-secondary text-sm">{detectorBusy === 'test' ? 'Testing detector…' : 'Test detector'}</button>
          </div>
          <p className="text-sm text-surface-400">Start the detector server separately. Its health response shows the loaded model. The detector server controls its model and device.</p>
          <p className="text-xs text-surface-400">Start with YOLOE-26s. Compare YOLOE-26m or YOLOE-26l when more memory is available.</p>
        </div>}
        {source === 'vlm' && <p className="text-sm text-surface-400 pt-2">Compare Qwen3.8 or Qwen3-VL on your photos. Review small objects and repeated items. Boxes are model estimates.</p>}
        <button type="submit" disabled={!!detectorBusy} className="btn-primary text-sm !mt-5">{detectorBusy === 'save' ? 'Saving…' : 'Save detection settings'}</button>
      </fieldset>
      <Feedback result={detectorResult} />
    </form>

    <form onSubmit={saveScan} className="card !p-5 sm:!p-6 space-y-5">
      <div><h2 className="text-xl text-surface-100 font-semibold">Scan limits</h2><p className="text-sm text-surface-400 mt-2">Control image detail, output length, and local memory use.</p></div>
      <fieldset disabled={scanBusy} className="space-y-5">
        {FIELDS.map(field => <div key={field.id} className="grid sm:grid-cols-[minmax(0,1fr)_170px] gap-3">
          <div><label htmlFor={field.id} className="field-label">{field.label}</label><p id={`${field.id}-help`} className="text-sm text-surface-400">{field.help}</p></div>
          <div><div className="flex items-center gap-2"><input id={field.id} type="number" required min={field.min} max={field.max} step="1" value={scan[field.id]}
            onChange={event => { setScan(previous => ({ ...previous, [field.id]: event.target.value })); setScanResult(null); }}
            aria-describedby={`${field.id}-help`} className="input-field text-sm tabular-nums min-w-0" /><span className="text-xs text-surface-400">{field.unit}</span></div>
            <p className="text-xs text-surface-400 mt-2 tabular-nums">{field.min}–{field.max}</p></div>
        </div>)}
        <div className="flex flex-wrap gap-2 pt-2">
          <button type="submit" className="btn-primary text-sm">{scanBusy ? 'Saving…' : 'Save scan limits'}</button>
          <button type="button" className="btn-secondary text-sm" onClick={() => { setScan({ scan_max_edge: 1280, scan_max_tokens: 4096, ollama_num_ctx: 8192 }); setScanResult(null); }}>Use starting values</button>
        </div>
        <p className="text-xs text-surface-400">For 32 GB RAM, start with one scan at a time. Higher limits can increase memory use and inference time.</p>
      </fieldset>
      <Feedback result={scanResult} />
    </form>
  </div>;
}
