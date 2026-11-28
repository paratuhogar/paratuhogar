import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
test('mutable public image map revalidates online and preserves a verified offline fallback', async () => {
  const events = {}, entries = new Map();
  let offline = false, calls = 0, cacheMode;
  const cache = {match: async request => entries.get(request.url)?.clone(), put: async (request, response) => entries.set(request.url, response)};
  vm.runInNewContext(source, {
    URL, Response, AbortController, setTimeout, clearTimeout, console, importScripts() {},
    self: {location: {origin: 'https://paratuhogar.org'}, addEventListener: (name, fn) => events[name] = fn},
    caches: {open: async () => cache},
    fetch: async (_request, options) => {calls++; cacheMode = options?.cache; if (offline) throw Error('offline'); return new Response('new public map', {headers: {'content-type': 'application/javascript'}});}
  });
  const request = {url: 'https://paratuhogar.org/js/image-variants.js?v=20261128-mobile2', method: 'GET', mode: 'same-origin', headers: new Headers()};
  entries.set(request.url, new Response('old public map'));
  const dispatch = async () => {let response; events.fetch({request, respondWith: p => response = p}); return (await response).text();};
  assert.equal(await dispatch(), 'new public map');
  assert.equal(calls, 1);
  assert.equal(cacheMode, 'no-cache');
  offline = true;
  assert.equal(await dispatch(), 'new public map');
  for (const url of ['https://paratuhogar.org/js/image-variants.js?private=1', 'https://example.com/js/image-variants.js', 'https://paratuhogar.org/functions/v1/secure-data']) {
    events.fetch({request: {...request, url}, respondWith() {assert.fail('only exact public allowlisted map is handled');}});
  }
});

test('a stalled map revalidation falls back promptly instead of blocking ordered startup', async () => {
  const events = {};
  let timeoutMs;
  const request = {url: 'https://paratuhogar.org/js/image-variants.js?v=20261128-mobile2', method: 'GET', mode: 'same-origin'};
  vm.runInNewContext(source, {
    URL, Response, AbortController, console, importScripts() {}, clearTimeout,
    setTimeout(fn, ms) {timeoutMs = ms; return setTimeout(fn, 1);},
    self: {location: {origin: 'https://paratuhogar.org'}, addEventListener: (name, fn) => events[name] = fn},
    caches: {open: async () => ({match: async () => new Response('cached map')})},
    fetch: (_req, options) => new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(Error('timeout'))))
  });
  let response;
  events.fetch({request, respondWith: p => response = p});
  let value;
  Promise.resolve(response).then(r => r.text()).then(text => value = text);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(value, 'cached map');
  assert.ok(timeoutMs > 0 && timeoutMs <= 3000);
});
