import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const previousCache = 'pth-public-static-2026-10-05-copy2';
const previousBundle = '/js/storefront-extras.min.js?v=20261003-welcome2';
const nextBundle = '/js/storefront-extras.min.js?v=20261006-all-pending1';

test('a waiting worker preserves the active offline template and its bundle until activation', async () => {
    const stores = new Map(), deleted = [];
    const key = request => typeof request === 'string' ? request : new URL(request.url).pathname + new URL(request.url).search;
    const caches = {
        async open(name) {
            if (!stores.has(name)) stores.set(name, new Map());
            const entries = stores.get(name);
            return {
                async addAll(urls) {
                    for (const url of urls) entries.set(url, new Response(url === '/index.html' ? template : url));
                },
                async match(request) { return entries.get(key(request))?.clone(); },
                async put(request, response) { entries.set(key(request), response); }
            };
        },
        async keys() { return [...stores.keys()]; },
        async delete(name) { deleted.push(name); return stores.delete(name); },
        async match(request) {
            for (const entries of stores.values()) if (entries.has(key(request))) return entries.get(key(request)).clone();
        }
    };
    let template = html.replace(nextBundle.slice(1), previousBundle.slice(1));
    const worker = script => {
        const events = {};
        vm.runInNewContext(script, { URL, Response, console, caches, importScripts() {},
            fetch: async () => { throw Error('offline'); },
            get indexedDB() { throw Error('This upgrade must not touch account data or pending queues'); },
            self: { location: { origin: 'https://example.test' }, addEventListener(name, handler) { events[name] = handler; }, clients: { claim: async () => {} }, skipWaiting() {} }
        });
        return events;
    };
    const lifecycle = async (events, name) => { let work; events[name]({ waitUntil(promise) { work = promise; } }); await work; };
    const previous = worker(source.replace(/const PTH_CACHE_VERSION = '[^']+';/, `const PTH_CACHE_VERSION = '${previousCache}';`).replaceAll(nextBundle, previousBundle));
    await lifecycle(previous, 'install');
    await caches.open('pth-public-images-v1'); await caches.open('unrelated-cache');
    template = html;
    const waiting = worker(source);
    await lifecycle(waiting, 'install');
    const navigate = async events => {
        let response;
        events.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://example.test/' }, respondWith(promise) { response = promise; } });
        return (await response).text();
    };
    assert.ok((await navigate(previous)).includes(previousBundle.slice(1)), 'the active worker still serves its compatible template');
    let oldAsset;
    previous.fetch({ request: { method: 'GET', url: 'https://example.test' + previousBundle }, respondWith(promise) { oldAsset = promise; } });
    assert.equal(await (await oldAsset).text(), previousBundle);
    assert.deepEqual(deleted, [], 'install never deletes the active public cache');
    await lifecycle(waiting, 'activate');
    assert.ok((await navigate(waiting)).includes(nextBundle.slice(1)));
    let nextAsset;
    waiting.fetch({ request: { method: 'GET', url: 'https://example.test' + nextBundle }, respondWith(promise) { nextAsset = promise; } });
    assert.equal(await (await nextAsset).text(), nextBundle);
    assert.deepEqual(deleted, [previousCache]);
    assert.ok(stores.has('pth-public-images-v1')); assert.ok(stores.has('unrelated-cache'));
});
