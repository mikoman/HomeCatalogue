import test from 'node:test';
import assert from 'node:assert/strict';
import { createScanQueue, createUploadRequestId } from '../src/utils/scanQueueStore.js';
import { prepareReview } from '../src/utils/scanReview.js';
import { writeReviewDraft } from '../src/utils/scanStorage.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const status = (changes = {}) => ({ scan_session_id: 'scan-one', room_id: 1, container_id: null, result_revision: 'r1', status: 'completed', image_url: '/photo.jpg', result: { items: [{ name: 'Mug' }], proposed_containers: [] }, ...changes });
const setup = (overrides = {}) => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const events = new Map();
  const api = { listActive: async () => [], getStatus: async () => status(), upload: async () => ({ scan_session_id: 'scan-one' }), retry: async () => status({ status: 'pending', result: null, result_revision: 'r2' }), dismiss: async () => {}, ...overrides.api };
  const queue = createScanQueue({ api, storage, compressImage: overrides.compressImage || (async file => file), createObjectURL: () => 'blob:photo', revokeObjectURL: () => {}, schedule: () => 1, cancel: () => {}, browserWindow: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) } });
  return { queue, api, storage, events };
};

test('an upload remains visible after leaving and returning to its room', async () => {
  const upload = deferred();
  const { queue } = setup({ api: { upload: () => upload.promise } });
  const leave = queue.subscribe(1, () => {});
  queue.addFiles(1, [{ name: 'photo.jpg' }]);
  leave();
  queue.subscribe(2, () => {})();
  const returnToRoom = queue.subscribe(1, () => {});
  upload.resolve({ scan_session_id: 'scan-one' });
  await queue.whenUploadsSettle();
  assert.equal(queue.snapshot(1).scans[0].sessionId, 'scan-one');
  assert.equal(queue.snapshot(1).scans[0].status, 'completed');
  returnToRoom();
  queue.dispose();
});

test('failed files retain a retry action after their room unmounts', async () => {
  let attempts = 0;
  const { queue } = setup({ api: { upload: async () => { if (++attempts === 1) throw new Error('Offline'); return { scan_session_id: 'scan-one' }; } } });
  const leave = queue.subscribe(1, () => {});
  queue.addFiles(1, [{ name: 'photo.jpg' }]);
  leave();
  await queue.whenUploadsSettle();
  const failed = queue.snapshot(1).scans[0];
  assert.equal(failed.status, 'upload_failed');
  await queue.retryScan(1, failed.sessionId);
  assert.equal(queue.snapshot(1).scans[0].status, 'completed');
  assert.equal(attempts, 2);
  queue.dispose();
});

test('the reload warning remains active across routes until upload succeeds', async () => {
  const upload = deferred();
  const { queue, events } = setup({ api: { upload: () => upload.promise } });
  const leave = queue.subscribe(1, () => {});
  queue.addFiles(1, [{ name: 'photo.jpg' }]);
  leave();
  assert.ok(events.has('beforeunload'));
  upload.resolve({ scan_session_id: 'scan-one' });
  await queue.whenUploadsSettle();
  assert.equal(events.has('beforeunload'), false);
  queue.dispose();
});

test('a moved scan leaves the old room and offers its current room', async () => {
  const { queue, api } = setup();
  queue.setScans(1, [{ sessionId: 'scan-one', status: 'pending' }]);
  api.getStatus = async () => status({ room_id: 2, container_id: 8 });
  await queue.refreshScan(1, 'scan-one');
  assert.equal(queue.snapshot(1).scans.length, 0);
  assert.deepEqual(queue.snapshot(1).relocated, [{ sessionId: 'scan-one', roomId: 2 }]);
  assert.equal(queue.snapshot(2).scans[0].containerId, 8);
  queue.dispose();
});

test('an explicit server null clears a deleted scan target', async () => {
  const { queue } = setup();
  queue.setScans(1, [{ sessionId: 'scan-one', status: 'pending', containerId: 8 }]);
  await queue.refreshScan(1, 'scan-one');
  assert.equal(queue.snapshot(1).scans[0].containerId, null);
  queue.dispose();
});

test('a saved draft applies only to the same result revision', async () => {
  const { queue, storage } = setup();
  const draft = prepareReview({ sessionId: 'scan-one', resultRevision: 'old-revision', result: { items: [{ name: 'Obsolete edit' }], proposed_containers: [] } }, [], []);
  writeReviewDraft('scan-one', draft, storage);
  await queue.refreshScan(1, 'scan-one');
  assert.equal(queue.snapshot(1).scans[0].result.items[0].name, 'Mug');
  assert.equal(queue.snapshot(1).scans[0].resultRevision, 'r1');
  queue.dispose();
});

test('matching revisions preserve edited names and selections', async () => {
  const { queue, storage } = setup();
  const draft = prepareReview({ sessionId: 'scan-one', resultRevision: 'r1', result: { items: [{ name: 'Edited mug' }], proposed_containers: [] } }, [], []);
  draft.itemSkip[0] = true;
  writeReviewDraft('scan-one', draft, storage);
  await queue.refreshScan(1, 'scan-one');
  assert.equal(queue.snapshot(1).scans[0].result.items[0].name, 'Edited mug');
  assert.deepEqual(queue.snapshot(1).scans[0].itemSkip, [true]);
  queue.dispose();
});

test('a lost retry response cannot restore an obsolete draft', async () => {
  const { queue, api } = setup();
  const draft = prepareReview({ sessionId: 'scan-one', status: 'completed', resultRevision: 'r1', result: { items: [{ name: 'Obsolete edit' }], proposed_containers: [] } }, [], []);
  queue.setScans(1, [draft]);
  api.retry = async () => { api.getStatus = async () => status({ result_revision: 'r2' }); throw new Error('Response lost'); };
  await queue.retryScan(1, 'scan-one');
  assert.equal(queue.snapshot(1).scans[0].result.items[0].name, 'Mug');
  assert.equal(queue.snapshot(1).scans[0].resultRevision, 'r2');
  queue.dispose();
});


test('upload retries retain one request ID after a lost response', async () => {
  const requestIds = [];
  const { queue } = setup({ api: { upload: async (_roomId, _file, options) => {
    requestIds.push(options.requestId);
    if (requestIds.length === 1) throw new Error('Response lost');
    return { scan_session_id: 'scan-one' };
  } } });
  queue.addFiles(1, [{ name: 'photo.jpg' }]);
  await queue.whenUploadsSettle();
  const failed = queue.snapshot(1).scans[0];
  await queue.retryScan(1, failed.sessionId);
  assert.equal(requestIds.length, 2);
  assert.equal(requestIds[0], requestIds[1]);
  assert.match(requestIds[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  queue.dispose();
});

test('HTTP phone access creates a valid UUID without crypto.randomUUID', () => {
  const id = createUploadRequestId({ getRandomValues: bytes => bytes.fill(255) });
  assert.equal(id, 'ffffffff-ffff-4fff-bfff-ffffffffffff');
});

test('a late recovery response cannot restore a dismissed scan', async () => {
  const recovery = deferred();
  const { queue } = setup({ api: { listActive: () => recovery.promise } });
  queue.setScans(1, [{ sessionId: 'scan-one', status: 'completed' }]);
  const hydrated = queue.hydrate(1);
  await queue.removeScan(1, 'scan-one');
  recovery.resolve([status()]);
  await hydrated;
  assert.equal(queue.snapshot(1).scans.length, 0);
  queue.dispose();
});
