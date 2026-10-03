import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(count = 23) {
 const root = { navigator: { canShare: () => true }, PTHSecureData: { token: () => 'account-a' } };
 const context = vm.createContext({ window: root, DOMException, File, Blob, URLSearchParams, TextEncoder, AbortController, setTimeout, clearTimeout });
 for (const name of ['studio-jobs', 'studio-collection']) vm.runInContext(fs.readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'), context);
 const files = Array.from({ length: count }, (_, index) => new File(['jpeg fixture'], `${index + 1}.jpg`, { type: 'image/jpeg' }));
 const batch = new root.PTHStudioJobs.Collection();
 batch.cache.get = async (_, index) => ({ name: files[index].name, blob: files[index] });
 batch.job = { id: 'artwork', entries: files.map(file => ({ name: file.name, size: file.size })), bytes: files.reduce((n, f) => n + f.size, 0) };
 batch.ready = { archive: new File(['complete zip fixture'], 'all.zip'), files: [], token: 'account-a', at: Date.now(), total: count };
 return { root, batch };
}

test('Chrome canShare false positive never sends over ten images; next groups retain every image', async () => {
 const { root, batch } = fixture();
 const sent = [];
 root.navigator.share = data => {
  if (data.files.length > 10) return Promise.reject(new DOMException("Failed to execute 'share' on 'Navigator': Permission denied", 'NotAllowedError'));
  sent.push(...data.files.map(file => file.name)); return Promise.resolve();
 };
 await batch.loadShare(0);
 assert.equal(batch.ready.files.length, 10);
 for (const next of [10, 20, 23]) { await batch.share(); assert.equal(batch.ready.shareStart, next); }
 assert.deepEqual(sent, Array.from({ length: 23 }, (_, i) => `${i + 1}.jpg`));
 assert.equal(batch.ready.files.length, 0);
});

test('native denial offers one-image retry without automatic sharing or losing archive/position; cancellation preserves it', async () => {
 const { root, batch } = fixture(), calls = [];
 root.navigator.share = data => { calls.push(data.files.length); throw new DOMException('Permission denied', 'NotAllowedError'); };
 await batch.loadShare(0);
 const archive = batch.ready.archive, originalFirst = batch.ready.files[0];
 const operation = batch.share(); assert.deepEqual(calls, [10], 'native API called synchronously');
 await assert.rejects(operation, { name: 'NotAllowedError' });
 assert.deepEqual(calls, [10], 'no automatic retry after activation is consumed');
 assert.equal(batch.ready.archive, archive); assert.equal(batch.ready.files[0], originalFirst);
 assert.equal(batch.ready.shareStart, 0); assert.equal(batch.ready.shareNext, 1); assert.equal(batch.valid(), true);
 root.navigator.share = data => { calls.push(data.files.length); return Promise.reject(new DOMException('cancel', 'AbortError')); };
 await assert.rejects(batch.share(), { name: 'AbortError' });
 assert.equal(batch.ready.archive, archive); assert.equal(batch.ready.shareStart, 0); assert.equal(batch.ready.shareNext, 1);
 root.navigator.share = data => { calls.push(data.files.length); return Promise.resolve(); };
 await batch.share();
 assert.deepEqual(calls, [10, 1, 1]); assert.equal(batch.ready.shareStart, 1); assert.equal(batch.ready.shareNext, 2);
 assert.equal(batch.ready.files.length, 1, 'future groups keep this device fallback'); assert.equal(batch.ready.files[0].name, '2.jpg');
 assert.equal(batch.ready.archive, archive);
});

test('activation and known blocked frame policy prevent native calls while preserving prepared images', async () => {
 const { root, batch } = fixture(1); let calls = 0;
 root.navigator.share = () => { calls++; return Promise.resolve(); };
 await batch.loadShare(0); const ready = batch.ready;
 root.navigator.userActivation = { isActive: false };
 await assert.rejects(batch.share(), { code: 'SHARE_GESTURE_REQUIRED' });
 assert.equal(calls, 0); assert.equal(batch.ready, ready); assert.equal(batch.canShare(), true, 'capability does not require activation');
 root.navigator.userActivation.isActive = true;
 root.document = { featurePolicy: { features: () => ['web-share'], allowsFeature: () => false } };
 assert.equal(batch.canShare(), false);
 await assert.rejects(batch.share(), { code: 'SHARE_POLICY_BLOCKED' });
 assert.equal(calls, 0); assert.equal(batch.ready, ready);
 root.document.featurePolicy.features = () => [];
 assert.equal(batch.canShare(), true, 'unknown policy feature cannot be mistaken for a known denial');
 const operation = batch.share(); assert.equal(calls, 1); await operation;
});

test('share error text explains recovery without leaking arbitrary browser/submitted text', () => {
 const { root } = fixture(), message = root.PTHStudioJobs.shareErrorMessage;
 const raw = "Failed to execute 'share' on 'Navigator': Permission denied <script>arbitrary instructions</script>";
 assert.match(message(new DOMException(raw, 'NotAllowedError'), { smallerGroup: true }), /una sola imagen/);
 assert.match(message(new DOMException(raw, 'NotAllowedError'), { single: true }), /imagen sigue preparada/);
 assert.match(message(new DOMException(raw, 'AbortError')), /cancelado/);
 for (const error of [new DOMException(raw, 'NotAllowedError'), new DOMException(raw, 'DataError'), Error(raw)]) assert.doesNotMatch(message(error), /Permission|Navigator|script|instructions/);
});

test('late native rejection after cancellation cannot resurrect private artwork', async () => {
 const { root, batch } = fixture(); let rejectShare;
 root.navigator.share = () => new Promise((_, reject) => { rejectShare = reject; });
 batch.cache.remove = async () => {};
 await batch.loadShare(0); const operation = batch.share(); batch.cancel();
 rejectShare(new DOMException('Permission denied', 'NotAllowedError'));
 await assert.rejects(operation, { name: 'NotAllowedError' });
 assert.equal(batch.ready, null); assert.equal(batch.job, null); assert.equal(batch.busy, false);
});
