export const PROVIDERS = [
  { id: 'ollama', label: 'Ollama', local: true, hint: 'Local models', example: 'qwen3.5:9b' },
  { id: 'lmstudio', label: 'LM Studio', local: true, hint: 'Local model server', example: 'Model ID from your server' },
  { id: 'omlx', label: 'oMLX', local: true, hint: 'Apple silicon server', example: 'Model ID from your server' },
  { id: 'openrouter', label: 'OpenRouter', local: false, hint: 'Cloud model catalogue', example: 'google/gemini-3.8-flash', keyUrl: 'https://openrouter.ai/keys' },
  { id: 'openai', label: 'OpenAI', local: false, hint: 'Direct cloud API', example: 'Vision model ID', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Anthropic', local: false, hint: 'Direct Claude API', example: 'Vision model ID', keyUrl: 'https://platform.claude.com/settings/keys' },
];

export function createDraft(config) {
  return { base_url: config.base_url, model: config.model, embedding_model: config.embedding_model || '', api_key: '', api_key_action: 'keep' };
}

export function connectionPayload(provider, draft) {
  const payload = { provider, base_url: draft.base_url.trim(), api_key_action: draft.api_key_action };
  if (draft.api_key_action === 'keep' && draft.api_key.trim()) {
    payload.api_key = draft.api_key.trim();
    payload.api_key_action = 'replace';
  }
  return payload;
}

export function providerPayload(provider, draft, activate = true) {
  return { ...connectionPayload(provider, draft), model: draft.model.trim(), embedding_model: draft.embedding_model.trim(), activate };
}

export function isDirty(draft, config) {
  return draft.base_url !== config.base_url || draft.model !== config.model
    || draft.embedding_model !== (config.embedding_model || '') || !!draft.api_key || draft.api_key_action !== 'keep';
}

export function filterModels(models, query) {
  const search = query.trim().toLowerCase();
  return models.filter(model => `${model.id} ${model.name}`.toLowerCase().includes(search));
}
