import test from 'node:test';
import assert from 'node:assert/strict';
import { fitImageSize, formatFileSize } from '../src/utils/imageCompression.js';
import { buildScanAcceptance, prepareReview, reconcileReview, selectedReviewCount } from '../src/utils/scanReview.js';
import { enqueueRoomScan, readActiveScans, readReviewDraft, writeActiveScans, writeReviewDraft, clearReviewDraft } from '../src/utils/scanStorage.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const photo = (items, containers = []) => ({ sessionId: 'scan-a', resultRevision: 'revision-1', result: { items, proposed_containers: containers } });

test('portrait and landscape photos keep their aspect ratio within both limits', () => {
  assert.deepEqual(fitImageSize(4000, 6000), { width: 1280, height: 1920 });
  assert.deepEqual(fitImageSize(6000, 4000), { width: 1920, height: 1280 });
  assert.deepEqual(fitImageSize(800, 600), { width: 800, height: 600 });
  assert.throws(() => fitImageSize(0, 20), /dimensions/);
});

test('file sizes handle invalid and large input', () => {
  assert.equal(formatFileSize(-1), '0 B');
  assert.equal(formatFileSize(2048), '2 KB');
  assert.equal(formatFileSize(Infinity), '0 B');
});

test('scan recovery isolates rooms and removes duplicate scan IDs', () => {
  const storage = memoryStorage();
  enqueueRoomScan(1, 'one', storage);
  enqueueRoomScan(1, 'one', storage);
  enqueueRoomScan(2, 'two', storage);
  assert.deepEqual(readActiveScans(1, storage), ['one']);
  assert.deepEqual(readActiveScans(2, storage), ['two']);
});

test('damaged storage and blocked writes do not crash capture', () => {
  const storage = memoryStorage();
  storage.setItem('homeCatalogue:activeScans:1', '{invalid');
  assert.deepEqual(readActiveScans(1, storage), []);
  storage.setItem('homeCatalogue:activeScans:1', '{"wrong":true}');
  assert.deepEqual(readActiveScans(1, storage), []);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(readActiveScans(1, blocked), []);
  assert.equal(writeActiveScans(1, ['one'], blocked), false);
});

test('review edits and selection survive storage and clear after saving', () => {
  const storage = memoryStorage();
  const { result, resultRevision, existingContainers, itemTargets, containerFlags, dupeMatches, itemSkip, proposedSkip, proposedTargets } = prepareReview(photo([{ name: 'Edited mug' }]), [], []);
  const draft = { result, resultRevision, existingContainers, itemTargets, containerFlags, dupeMatches, itemSkip: [true], proposedSkip, proposedTargets };
  assert.equal(writeReviewDraft('one', draft, storage), true);
  assert.deepEqual(readReviewDraft('one', storage), draft);
  clearReviewDraft('one', storage);
  assert.equal(readReviewDraft('one', storage), null);
});

test('matching names suggest a duplicate without silently excluding an object', () => {
  const review = prepareReview(photo([{ name: 'Mug' }]), [], [{ id: 42, name: 'mug' }]);
  assert.equal(review.dupeMatches[0].id, 42);
  assert.deepEqual(review.itemSkip, [false]);
});

test('a container photo seeds every item with the selected container', () => {
  const review = prepareReview({ ...photo([{ name: 'Mug', suggested_container: 'Shelf' }]), containerId: 8 }, [{ id: 8, name: 'Drawer' }], []);
  assert.deepEqual(buildScanAcceptance(review).items[0].container_id, 8);
});

test('save creates only proposed containers used by selected items', () => {
  const review = prepareReview(photo([{ name: 'Mug', suggested_container: 'Shelf' }, { name: 'Cable', suggested_container: 'Box' }], [{ name: 'Shelf' }, { name: 'Box' }]), [], []);
  review.itemSkip[1] = true;
  review.proposedSkip[1] = true;
  const payload = buildScanAcceptance(review);
  assert.equal(payload.containers.length, 1);
  assert.equal(payload.containers[0].name, 'Shelf');
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].proposed_container_index, 0);
  assert.equal(payload.items[0].notes, '');
});

test('existing destinations stay as IDs and names are trimmed on save', () => {
  const review = prepareReview(photo([{ name: ' Mug ', suggested_container: 'Shelf' }], [{ name: 'Shelf' }]), [{ id: 9, name: 'Shelf' }], []);
  const payload = buildScanAcceptance(review);
  assert.equal(payload.items[0].name, 'Mug');
  assert.equal(payload.items[0].container_id, 9);
  assert.equal(payload.containers.length, 0);
});

test('promoted containers retain the selected parent', () => {
  const review = prepareReview(photo([{ name: 'Small box' }]), [{ id: 3, name: 'Cupboard' }], []);
  review.containerFlags[0] = true;
  review.itemTargets[0] = { kind: 'existing', containerId: 3 };
  assert.deepEqual(buildScanAcceptance(review), { items: [], containers: [{ name: 'Small box', description: '', parent_id: 3 }] });
});

test('an explicit room destination overrides a container photo target', () => {
  const review = prepareReview({ ...photo([{ name: 'Mug' }]), containerId: 8 }, [], []);
  review.itemTargets[0] = { kind: 'loose' };
  assert.equal(buildScanAcceptance(review).items[0].container_id, null);
});

test('blank selected names block save while skipped blank names do not', () => {
  const review = prepareReview(photo([{ name: '  ' }, { name: 'Book' }]), [], []);
  assert.throws(() => buildScanAcceptance(review), /name before saving/);
  review.itemSkip[0] = true;
  assert.equal(buildScanAcceptance(review).items.length, 1);
});


test('a blocked localStorage getter cannot crash scan recovery', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    assert.deepEqual(readActiveScans(1), []);
    assert.equal(writeActiveScans(1, ['one']), false);
    assert.equal(readReviewDraft('one'), null);
    assert.equal(writeReviewDraft('one', {}), false);
    assert.doesNotThrow(() => clearReviewDraft('one'));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('incomplete drafts cannot replace the current scan result', () => {
  const storage = memoryStorage();
  writeReviewDraft('one', { result: { items: [{ name: 'Mug' }] } }, storage);
  assert.equal(readReviewDraft('one', storage), null);
});

test('equal container names under different parents cannot misfile a room photo', () => {
  const containers = [{ id: 1, name: 'Drawer', parent_id: 10 }, { id: 2, name: 'Drawer', parent_id: 20 }];
  const review = prepareReview(photo([{ name: 'Keys', suggested_container: 'Drawer' }]), containers, []);
  assert.deepEqual(review.itemTargets, [{ kind: 'loose' }]);
  review.itemTargets[0] = { kind: 'existing', containerId: 2 };
  assert.equal(buildScanAcceptance(review).items[0].container_id, 2);
});

test('an ambiguous root container name requires an explicit destination', () => {
  const containers = [{ id: 1, name: 'Drawer', parent_id: null }, { id: 2, name: 'Drawer', parent_id: null }];
  const review = prepareReview(photo([{ name: 'Keys', suggested_container: 'Drawer' }], [{ name: 'Drawer' }]), containers, []);
  assert.deepEqual(review.itemTargets, [{ kind: 'loose' }]);
});

test('a proposed container cannot reuse the same name under a different parent', () => {
  const review = prepareReview(photo([{ name: 'Keys', suggested_container: 'Drawer' }], [{ name: 'Drawer' }]), [{ id: 2, name: 'Drawer', parent_id: 20 }], []);
  const payload = buildScanAcceptance(review);
  assert.equal(payload.containers.length, 1);
  assert.equal(payload.containers[0].parent_id, null);
  assert.equal(payload.items[0].proposed_container_index, 0);
});

test('equal item names remain separate selected objects', () => {
  const review = prepareReview(photo([{ name: 'Cup' }, { name: 'Cup' }]), [], [{ id: 8, name: 'Cup' }]);
  assert.deepEqual(review.itemSkip, [false, false]);
  assert.equal(buildScanAcceptance(review).items.length, 2);
});


test('a container-only photo produces a valid save', () => {
  const review = prepareReview(photo([], [{ name: 'Shelf' }]), [], []);
  assert.equal(selectedReviewCount(review), 1);
  assert.deepEqual(buildScanAcceptance(review), { items: [], containers: [{ name: 'Shelf', description: '', parent_id: null }] });
});

test('a container-only photo preserves its selected parent', () => {
  const review = prepareReview({ ...photo([], [{ name: 'Small box' }]), containerId: 8 }, [{ id: 8, name: 'Cupboard' }], []);
  assert.equal(buildScanAcceptance(review).containers[0].parent_id, 8);
});

test('empty reviews cannot finish with an empty acceptance request', () => {
  const review = prepareReview(photo([]), [], []);
  assert.equal(selectedReviewCount(review), 0);
  assert.throws(() => buildScanAcceptance(review), /Select at least one/);
});

test('required proposed containers stay in the selected count', () => {
  const review = prepareReview(photo([{ name: 'Mug', suggested_container: 'Shelf' }], [{ name: 'Shelf' }]), [], []);
  review.proposedSkip[0] = true;
  assert.equal(selectedReviewCount(review), 2);
  assert.equal(buildScanAcceptance(review).containers.length, 1);
});

test('deleted destinations require correction without losing names or selections', () => {
  const review = prepareReview({ ...photo([{ name: 'Edited mug' }, { name: 'Skipped book' }]), containerId: 8 }, [{ id: 8, name: 'Drawer' }], []);
  review.itemSkip[1] = true;
  const current = reconcileReview(review, [{ id: 9, name: 'Shelf' }]);
  assert.equal(current.result.items[0].name, 'Edited mug');
  assert.deepEqual(current.itemSkip, [false, true]);
  assert.equal(current.itemTargets[0].kind, 'missing');
  assert.equal(current.itemTargets[0].name, 'Drawer');
  assert.equal(current.existingContainers[0].id, 9);
  assert.throws(() => buildScanAcceptance(current), /moved or deleted/);
  current.itemTargets[0] = { kind: 'existing', containerId: 9 };
  assert.equal(buildScanAcceptance(current).items[0].container_id, 9);
});

test('deleted proposed parents require correction before saving', () => {
  const review = prepareReview({ ...photo([], [{ name: 'Small box' }]), containerId: 8 }, [{ id: 8, name: 'Drawer' }], []);
  const current = reconcileReview(review, []);
  assert.equal(current.proposedTargets[0].kind, 'missing');
  assert.equal(current.proposedSkip[0], false);
  assert.throws(() => buildScanAcceptance(current), /moved or deleted/);
  current.proposedTargets[0] = { kind: 'loose' };
  assert.equal(buildScanAcceptance(current).containers[0].parent_id, null);
});
