import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { itemLocationLabels } from '../src/utils/itemLocations.js';

const themeScript = readFileSync(new URL('../public/theme.js', import.meta.url), 'utf8');

function browser({ saved = null, systemDark = false, blocked = false } = {}) {
  const values = new Map(saved === null ? [] : [['homeCatalogue:theme', saved]]);
  const events = {};
  const system = { matches: systemDark, addEventListener: (name, listener) => { events.system = listener; } };
  const root = { dataset: {}, style: {}, classList: { toggle: (name, enabled) => { root.dark = enabled; } } };
  const meta = { setAttribute: (name, value) => { meta[name] = value; } };
  const localStorage = {
    getItem(key) { if (blocked) throw new Error('Storage blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Storage blocked'); values.set(key, value); },
  };
  const window = { localStorage, matchMedia: () => system, addEventListener: (name, listener) => { events[name] = listener; } };
  const document = { documentElement: root, querySelector: () => meta };
  vm.runInNewContext(themeScript, { window, document });
  return { window, root, meta, system, events, values, theme: window.homeCatalogueTheme };
}

test('the first paint follows the system when no valid choice exists', () => {
  assert.equal(browser().root.dataset.theme, 'light');
  const dark = browser({ saved: 'invalid', systemDark: true });
  assert.equal(dark.root.dataset.theme, 'dark');
  assert.equal(dark.root.style.colorScheme, 'dark');
  assert.equal(dark.meta.content, '#131e19');
});

test('a saved choice overrides the system before React starts', () => {
  const light = browser({ saved: 'light', systemDark: true });
  assert.equal(light.root.dataset.theme, 'light');
  assert.equal(light.root.dark, false);
  assert.equal(light.meta.content, '#f5f2eb');
  assert.equal(browser({ saved: 'dark' }).root.dark, true);
});

test('a manual change persists and updates subscribed switches', () => {
  const page = browser();
  let changes = 0;
  const unsubscribe = page.theme.subscribe(() => changes++);
  page.theme.setTheme('dark');
  assert.equal(page.values.get('homeCatalogue:theme'), 'dark');
  assert.equal(page.theme.getTheme(), 'dark');
  assert.equal(changes, 1);
  unsubscribe();
  page.theme.setTheme('light');
  assert.equal(changes, 1);
});

test('blocked storage does not prevent switching within the page', () => {
  const page = browser({ blocked: true, systemDark: true });
  assert.equal(page.theme.getTheme(), 'dark');
  assert.doesNotThrow(() => page.theme.setTheme('light'));
  assert.equal(page.root.dataset.theme, 'light');
});

test('system changes apply only before an explicit choice', () => {
  const page = browser();
  page.system.matches = true;
  page.events.system();
  assert.equal(page.theme.getTheme(), 'dark');
  page.theme.setTheme('light');
  page.events.system();
  assert.equal(page.theme.getTheme(), 'light');
});

test('another tab can update the choice or restore the system default', () => {
  const page = browser();
  page.values.set('homeCatalogue:theme', 'dark');
  page.events.storage({ key: 'unrelated' });
  assert.equal(page.theme.getTheme(), 'light');
  page.events.storage({ key: 'homeCatalogue:theme' });
  assert.equal(page.theme.getTheme(), 'dark');
  page.values.clear();
  page.events.storage({ key: null });
  assert.equal(page.theme.getTheme(), 'light');
});

test('invalid theme values do not replace the saved choice', () => {
  const page = browser({ saved: 'dark' });
  page.theme.setTheme('sepia');
  assert.equal(page.theme.getTheme(), 'dark');
  assert.equal(page.values.get('homeCatalogue:theme'), 'dark');
});

test('grouped items keep distinct nested, loose, and missing locations', () => {
  const containers = [{ id: 1, name: 'Cupboard', parent_id: null }, { id: 2, name: 'Coffee shelf', parent_id: 1 }];
  assert.deepEqual(itemLocationLabels([{ container_id: 2 }, { container_id: 2 }, { container_id: null }, { container_id: 8 }], containers),
    ['Cupboard / Coffee shelf', 'Loose in room', 'Location unavailable']);
});
