import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, createDraft, connectionPayload, providerPayload, isDirty, filterModels } from '../src/utils/settings-draft.js';
import { aiSettings } from '../src/api/client.js';

const config = { base_url: 'http://localhost:1234/v1', model: 'vision', embedding_model: 'embed', api_key_configured: true };

test('all supported providers have separate empty credential drafts', () => {
  assert.deepEqual(PROVIDERS.map(provider => provider.id), ['ollama', 'lmstudio', 'omlx', 'openrouter', 'deepseek', 'openai', 'anthropic']);
  const draft = createDraft(config);
  assert.equal(draft.api_key, '');
  assert.equal(isDirty(draft, config), false);
  assert.equal('api_key' in connectionPayload('lmstudio', draft), false);
});

test('a pasted key replaces the key while an empty field preserves it', () => {
  const draft = createDraft(config);
  draft.api_key = '  synthetic-test-key  ';
  const payload = providerPayload('lmstudio', draft, false);
  assert.equal(payload.api_key, 'synthetic-test-key');
  assert.equal(payload.api_key_action, 'replace');
  assert.equal(payload.activate, false);
  assert.equal(isDirty(draft, config), true);
  assert.equal(createDraft(config).api_key, '');
});

test('DeepSeek options remain separate from credentials and other provider settings', () => {
  const saved = {
    ...config, base_url: 'https://api.deepseek.com', model: 'deepseek-flash',
    deepseek: { image_detail: 'original', thinking: 'disabled', reasoning_effort: 'high', max_tokens: 8192 },
  };
  const draft = createDraft(saved);
  assert.equal(isDirty(draft, saved), false);
  draft.deepseek.thinking = 'enabled';
  draft.deepseek.image_detail = 'low';
  draft.deepseek.max_tokens = '65536';
  assert.equal(isDirty(draft, saved), true);
  assert.equal(saved.deepseek.thinking, 'disabled');
  assert.equal(saved.deepseek.max_tokens, 8192);
  const payload = providerPayload('deepseek', draft, false);
  assert.deepEqual(payload.deepseek, { image_detail: 'low', thinking: 'enabled', reasoning_effort: 'high', max_tokens: 65536 });
  assert.equal(payload.activate, false);
  assert.equal(payload.model, 'deepseek-flash');
  assert.equal('deepseek' in connectionPayload('deepseek', draft), false);
  assert.equal('deepseek' in providerPayload('ollama', draft), false);
  assert.equal('api_key' in payload, false);
  assert.equal(isDirty(createDraft(saved), saved), false);
});

test('an unchanged DeepSeek token count remains clean after number input editing', () => {
  const saved = { ...config, deepseek: { image_detail: 'original', thinking: 'disabled', reasoning_effort: 'high', max_tokens: 8192 } };
  const draft = createDraft(saved);
  draft.deepseek.max_tokens = '8192';
  assert.equal(isDirty(draft, saved), false);
});

test('clear and environment actions do not send an unused typed key', () => {
  for (const action of ['clear', 'environment']) {
    const payload = connectionPayload('openrouter', { ...createDraft(config), api_key_action: action, api_key: 'discarded-test-key' });
    assert.equal(payload.api_key_action, action);
    assert.equal('api_key' in payload, false);
  }
});

test('model search matches IDs and display names without changing the selected custom ID', () => {
  const models = [{ id: 'qwen/vision', name: 'Qwen Vision' }, { id: 'local', name: 'Small model' }];
  assert.deepEqual(filterModels(models, ' QWEN/ '), [models[0]]);
  assert.deepEqual(filterModels(models, 'small'), [models[1]]);
  assert.deepEqual(filterModels(models, 'missing'), []);
  assert.equal(providerPayload('lmstudio', { ...createDraft(config), model: 'custom-unlisted' }).model, 'custom-unlisted');
});

test('credential tests and discovery send keys in POST bodies, never URLs', async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ ok: true, models: [] }), { status: 200 });
  };
  try {
    const payload = connectionPayload('openrouter', { ...createDraft(config), api_key: 'synthetic-test-key' });
    await aiSettings.testConnection(payload);
    await aiSettings.listModels(payload);
    for (const request of requests) {
      assert.equal(request.options.method, 'POST');
      assert.equal(request.url.includes('synthetic-test-key'), false);
      assert.equal(request.url.includes('?'), false);
      assert.equal(JSON.parse(request.options.body).api_key, 'synthetic-test-key');
    }
  } finally { globalThis.fetch = original; }
});
