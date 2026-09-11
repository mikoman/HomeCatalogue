export default function DeepSeekSettings({ value, onChange }) {
  function edit(field, next) {
    onChange({ ...value, [field]: next });
  }

  return <div className="border-t border-surface-800 pt-5 space-y-4">
    <div>
      <h3 className="text-base font-semibold text-surface-100">DeepSeek scan settings</h3>
      <p className="text-sm text-surface-400 mt-2">Use <code>deepseek-flash</code> for photos. Scans always request JSON output.</p>
    </div>
    <div>
      <label htmlFor="deepseek-detail" className="field-label">Image detail</label>
      <select id="deepseek-detail" className="input-field text-sm" value={value.image_detail} onChange={event => edit('image_detail', event.target.value)} aria-describedby="deepseek-detail-help">
        <option value="original">Original (default)</option>
        <option value="low">Low — 512 × 512</option>
        <option value="high">High</option>
        <option value="auto">Auto</option>
      </select>
      <p id="deepseek-detail-help" className="text-xs text-surface-400 mt-2">Original preserves the image sent by this app. High and Auto currently use the same detail. Low reduces detail and cost.</p>
      <p className="text-xs text-surface-400 mt-1">The maximum image edge under Scans and boxes still applies before upload.</p>
    </div>
    <div>
      <label htmlFor="deepseek-thinking" className="field-label">Thinking mode</label>
      <select id="deepseek-thinking" className="input-field text-sm" value={value.thinking} onChange={event => edit('thinking', event.target.value)} aria-describedby="deepseek-thinking-help">
        <option value="disabled">Disabled (default)</option>
        <option value="enabled">Enabled</option>
      </select>
      <p id="deepseek-thinking-help" className="text-xs text-surface-400 mt-2">Thinking can help with difficult photos. It uses output tokens and can increase scan time.</p>
    </div>
    {value.thinking === 'enabled' && <div>
      <label htmlFor="deepseek-effort" className="field-label">Reasoning effort</label>
      <select id="deepseek-effort" className="input-field text-sm" value={value.reasoning_effort} onChange={event => edit('reasoning_effort', event.target.value)}>
        <option value="low">Low</option>
        <option value="high">High (default)</option>
        <option value="max">Maximum</option>
      </select>
    </div>}
    <div>
      <label htmlFor="deepseek-max-tokens" className="field-label">DeepSeek output limit (tokens)</label>
      <input id="deepseek-max-tokens" type="number" required min={256} max={393216} step="1" className="input-field text-sm tabular-nums"
        value={value.max_tokens} onChange={event => edit('max_tokens', event.target.value)} aria-describedby="deepseek-tokens-help" />
      <p id="deepseek-tokens-help" className="text-xs text-surface-400 mt-2">Default: 8192. Range: 256–393216. This replaces the shared output limit for DeepSeek scans.</p>
      <p className="text-xs text-surface-400 mt-1">The limit includes thinking and inventory output. Increase it if DeepSeek truncates the inventory.</p>
    </div>
    <p className="text-xs text-surface-400">
      <a href="https://api-docs.deepseek.com/guides/vision" target="_blank" rel="noreferrer" className="text-primary-400 underline">Vision guide</a>
      {' · '}
      <a href="https://api-docs.deepseek.com/guides/json_mode" target="_blank" rel="noreferrer" className="text-primary-400 underline">JSON output guide</a>
    </p>
  </div>;
}
