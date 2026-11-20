import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { MessageChannel } from 'node:worker_threads';

const workerSource = await fs.readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
const clientSource = await fs.readFile(new URL('../dist/pwa.mjs', import.meta.url), 'utf8');
const ORIGIN = 'https://games.example.test';
const markers = new Map([
  ['/index.html', 'platform'], ['/games/spinrealm/index.html', 'spinrealm'],
  ['/games/spinrealm/room.html', 'room'],
  ['/privacy.html', 'legal'], ['/cookies.html', 'legal'],
  ['/terms.html', 'legal'], ['/minor-protection.html', 'legal'],
  ['/games/52hunt/index.html', '52hunt'], ['/games/next-floor/index.html', 'next-floor'],
  ['/games/zero-dodge/index.html', 'zero-dodge'],
  ['/games/refract-maze/index.html', 'refract-maze'],
]);
const waveFixture = new Uint8Array(46);
const waveView = new DataView(waveFixture.buffer);
waveFixture.set([82,73,70,70],0);waveView.setUint32(4,38,true);
waveFixture.set([87,65,86,69,102,109,116,32],8);waveView.setUint32(16,16,true);
waveView.setUint16(20,1,true);waveView.setUint16(22,1,true);
waveView.setUint32(24,44100,true);waveView.setUint32(28,88200,true);
waveView.setUint16(32,2,true);waveView.setUint16(34,16,true);
waveFixture.set([100,97,116,97],36);waveView.setUint32(40,2,true);
const mp3Fixture = new Uint8Array([0x49,0x44,0x33,4,0,0,0,0,0,0,0xff,0xfb,0x90,0x64]);

function withMetadata(response, { url, redirected = false, type = 'basic' }) {
  Object.defineProperties(response, {
    url: { value: url }, redirected: { value: redirected }, type: { value: type },
  });
  const clone = response.clone.bind(response);
  response.clone = () => withMetadata(clone(), { url, redirected, type });
  return response;
}
function responseFor(url, overrides = {}) {
  const path = new URL(url).pathname;
  const canonical = path.endsWith('/') ? path + 'index.html' : path;
  const marker = markers.get(canonical);
  const mime = marker ? 'text/html; charset=utf-8' : path.endsWith('.css') ? 'text/css'
    : path.endsWith('.mjs') ? 'text/javascript' : path.endsWith('.png') ? 'image/png'
    : path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.wav') ? 'audio/x-wav'
    : path.endsWith('.mp3') ? 'audio/mpeg' : path.endsWith('.txt') ? 'text/plain'
    : path.endsWith('.json') ? 'application/json' : 'application/manifest+json';
  const body = marker ? `<!doctype html><html><body data-srg-page="${marker}">installed-${marker}</body></html>`
    : path.endsWith('.mjs') ? 'export const fixture = true;' : path.endsWith('.wav') ? waveFixture
    : path.endsWith('.mp3') ? mp3Fixture : path.endsWith('.json') || path.endsWith('.webmanifest') ? '{"fixture":true}' : 'fixture-resource';
  return withMetadata(new Response(overrides.body ?? body, {
    status: overrides.status ?? 200,
    headers: { 'Content-Type': overrides.mime ?? mime },
  }), { url: overrides.url ?? url, redirected: overrides.redirected ?? false, type: overrides.type ?? 'basic' });
}
function request(path, { mode = 'navigate', method = 'GET', headers } = {}) {
  const req = new Request(new URL(path, ORIGIN), { method, headers });
  Object.defineProperty(req, 'mode', { value: mode });
  return req;
}
function workerHarness() {
  const listeners = new Map();
  const stores = new Map();
  const broadcasts = [];
  const state = {
    fetcher: async req => responseFor(req.url),
    windows: [{ url: ORIGIN + '/', postMessage: message => broadcasts.push(message) }],
    skips: 0, claims: 0,
  };
  const keyFor = input => new URL(typeof input === 'string' ? input : input.url, ORIGIN).href;
  const cacheApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(key) { return entries.get(keyFor(key))?.clone(); },
        async put(key, value) { entries.set(keyFor(key), value.clone()); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener(type, fn) { listeners.set(type, fn); },
    clients: {
      async matchAll() { return state.windows; },
      async claim() { state.claims++; },
    },
    async skipWaiting() { state.skips++; },
  };
  const context = vm.createContext({ self, caches: cacheApi, fetch: req => state.fetcher(req), Request, Response, Headers, URL, Map, Set, console });
  vm.runInContext(workerSource, context);
  async function dispatch(type, fields = {}) {
    const waits = [];
    let handled = false, response;
    listeners.get(type)?.({
      ...fields,
      waitUntil(promise) { waits.push(promise); },
      respondWith(promise) { handled = true; response = promise; },
    });
    await Promise.all(waits);
    return { handled, response: handled ? await response : null };
  }
  async function message(data, source = ORIGIN + '/') {
    const replies = [];
    await dispatch('message', { data, source: { url: source }, ports: [{ postMessage: value => replies.push(value) }] });
    return replies[0];
  }
  return { state, stores, broadcasts, dispatch, message };
}

test('verified install provides offline platform and game, with no automatic update activation', async () => {
  const h = workerHarness();
  await h.dispatch('install');
  assert.equal(h.state.skips, 0);
  assert.equal((await h.message({ type: 'SRG_OFFLINE_STATUS' })).ready, true);
  h.state.fetcher = async () => { throw new TypeError('offline'); };
  for (const [path, marker] of [['/', 'platform'], ['/games/spinrealm/', 'spinrealm'], ['/games/52hunt/', '52hunt']]) {
    const result = await h.dispatch('fetch', { request: request(path) });
    assert.equal(result.handled, true);
    assert.match(await result.response.text(), new RegExp(`installed-${marker}`));
  }
});

test('auth pages, APIs, studio, query URLs, external URLs and POST never receive an offline fallback', async () => {
  const h = workerHarness();
  await h.dispatch('install');
  for (const [path, options] of [
    ['/signin-with-chatgpt', {}], ['/signout-with-chatgpt', {}], ['/callback?code=secret', {}],
    ['/api/session', {}], ['/studio/index.html', {}], ['/studio/model.mjs', { mode: 'cors' }],
    ['/?code=secret', {}], ['/unrelated-page', {}], ['https://outside.example/app.mjs', { mode: 'cors' }],
    ['/', { method: 'POST' }],
  ]) {
    assert.equal((await h.dispatch('fetch', { request: request(path, options) })).handled, false, path);
  }
  for (const entries of h.stores.values()) {
    assert.ok([...entries.keys()].every(url => !url.includes('/studio/') && !url.includes('/api/') && !url.includes('?')));
  }
});

test('a same-URL login page, redirect, wrong final URL or incorrect MIME fails the entire install', async () => {
  const badResponses = [
    { body: '<html><body><form>Sign in</form></body></html>' },
    { redirected: true },
    { url: ORIGIN + '/signin-with-chatgpt' },
    { mime: 'application/json' },
  ];
  for (const override of badResponses) {
    const h = workerHarness();
    h.state.fetcher = async req => responseFor(req.url, new URL(req.url).pathname === '/games/spinrealm/index.html' ? override : {});
    await assert.rejects(() => h.dispatch('install'));
    assert.equal(h.stores.size, 0, 'a partial shell must not survive failed install');
    assert.equal(h.state.skips, 0);
    assert.ok(h.broadcasts.some(message => message.type === 'SRG_OFFLINE_ERROR'));
    assert.equal((await h.message({ type: 'SRG_OFFLINE_STATUS' })).ready, false);
  }
});

test('HTML mislabeled as JavaScript is not accepted as an offline module', async () => {
  const h = workerHarness();
  h.state.fetcher = async req => responseFor(req.url, new URL(req.url).pathname === '/app.mjs'
    ? { mime: 'text/javascript', body: '<!doctype html><html><body>Login</body></html>' } : {});
  await assert.rejects(() => h.dispatch('install'));
  assert.equal(h.stores.size, 0);
});

test('verified WAV/MP3 and their credits are cached for complete offline GET requests', async () => {
  const h=workerHarness();
  h.state.fetcher=async req=>responseFor(req.url,new URL(req.url).pathname.endsWith('/rotate.wav')?{mime:'audio/wav'}:
    new URL(req.url).pathname.endsWith('/win.wav')?{mime:'audio/vnd.wave'}:{});
  await h.dispatch('install');
  assert.equal((await h.message({type:'SRG_OFFLINE_STATUS'})).ready,true);
  h.state.fetcher=async()=>{throw new TypeError('offline');};
  for(const [name,mime] of [['rotate.wav','audio/wav'],['win.wav','audio/vnd.wave'],['music-loop.mp3','audio/mpeg'],['credits.json','application/json'],['LICENSES.txt','text/plain']]){
    const result=await h.dispatch('fetch',{request:request('/games/spinrealm/audio/'+name,{mode:'cors'})});
    assert.equal(result.handled,true,name);assert.equal(result.response.status,200);
    assert.equal(result.response.headers.get('content-type'),mime);
  }
  assert.equal(h.state.skips,0);
});

test('offline audio byte ranges return exact closed, open-ended and suffix slices without replacing the full cache', async () => {
  const h = workerHarness();
  await h.dispatch('install');
  h.state.fetcher = async () => { throw new TypeError('offline'); };
  for (const [file, range, original, start, end, mime] of [
    ['rotate.wav', 'bytes=0-11', waveFixture, 0, 11, 'audio/x-wav'],
    ['rotate.wav', 'bytes=40-', waveFixture, 40, 45, 'audio/x-wav'],
    ['music-loop.mp3', 'bytes=-6', mp3Fixture, 8, 13, 'audio/mpeg'],
    ['music-loop.mp3', 'bytes=0-99999', mp3Fixture, 0, 13, 'audio/mpeg'],
    ['rotate.wav', 'bytes=-99', waveFixture, 0, 45, 'audio/x-wav'],
  ]) {
    const { handled, response } = await h.dispatch('fetch', { request: request('/games/spinrealm/audio/' + file, {
      mode: 'cors', headers: { Range: range },
    }) });
    assert.equal(handled, true, range);
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get('content-type'), mime);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${original.length}`);
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-length'), String(end - start + 1));
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), original.slice(start, end + 1));
  }
  const path = '/games/spinrealm/audio/music-loop.mp3';
  for (const headers of [{}, { Range: 'bytes=0-3', 'If-Range': '"another-representation"' }]) {
    const { response } = await h.dispatch('fetch', { request: request(path, { mode: 'cors', headers }) });
    assert.equal(response.status, 200, 'full GET and conservatively ignored If-Range retain the full verified file');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), mp3Fixture);
  }
  assert.equal((await h.message({ type: 'SRG_OFFLINE_STATUS' })).ready, true);
});

test('invalid audio ranges return 416 while HTML, unknown paths and non-audio range requests remain bypassed', async () => {
  const h = workerHarness();
  await h.dispatch('install');
  h.state.fetcher = async () => { throw new TypeError('offline'); };
  for (const range of ['bytes=46-99', 'bytes=10-2', 'bytes=-0', 'bytes=0-1,4-5', 'items=0-1', 'bytes=-', 'bytes=abc']) {
    const { response } = await h.dispatch('fetch', { request: request('/games/spinrealm/audio/rotate.wav', {
      mode: 'cors', headers: { Range: range },
    }) });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('content-range'), 'bytes */46');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-length'), '0');
    assert.equal(await response.text(), '');
  }
  for (const path of ['/', '/games/spinrealm/', '/games/spinrealm/engine.mjs',
    '/games/spinrealm/audio/unknown.mp3', '/games/spinrealm/audio/credits.json',
    '/games/spinrealm/audio/music-loop.mp3?session=private', 'https://outside.example/games/spinrealm/audio/music-loop.mp3']) {
    const result = await h.dispatch('fetch', { request: request(path, { headers: { Range: 'bytes=0-3' } }) });
    assert.equal(result.handled, false, path);
  }
});

test('audio range handling revalidates cached bytes and preserves network authorization responses on a bad or missing entry', async () => {
  const h = workerHarness();
  await h.dispatch('install');
  const path = '/games/spinrealm/audio/music-loop.mp3';
  const entries = [...h.stores.values()][0];
  const login = '<!doctype html><html><body>Sign in required</body></html>';
  const rejected = responseFor(ORIGIN + path, { status: 403, mime: 'text/html', body: login });
  h.state.fetcher = async req => {
    assert.equal(req.headers.get('range'), 'bytes=0-3', 'fallback must retain the original request');
    return rejected.clone();
  };
  for (const corrupted of [
    responseFor(ORIGIN + path, { mime: 'audio/mpeg', body: login }),
    responseFor(ORIGIN + path, { status: 206 }),
    null,
  ]) {
    if (corrupted) entries.set(ORIGIN + path, corrupted); else entries.delete(ORIGIN + path);
    const { response } = await h.dispatch('fetch', { request: request(path, { mode: 'cors', headers: { Range: 'bytes=0-3' } }) });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('content-range'), null);
    assert.equal(response.headers.get('content-type'), 'text/html');
    assert.equal(await response.text(), login, 'HTML must never be sliced into a fake audio response');
  }
  entries.set(ORIGIN + path, responseFor(ORIGIN + path, { mime: 'audio/mpeg', body: login }));
  h.state.fetcher = async () => { throw new TypeError('offline'); };
  await assert.rejects(() => h.dispatch('fetch', { request: request(path, { mode: 'cors', headers: { Range: 'bytes=0-3' } }) }), /offline/);
  assert.equal((await h.message({ type: 'SRG_OFFLINE_STATUS' })).ready, false);
});

test('incorrect audio MIME and unauthorized HTML disguised as audio or credits reject the whole new shell', async () => {
  const login='<!doctype html><html><body><form>Sign in required</form></body></html>';
  for(const [file,override] of [
    ['rotate.wav',{mime:'application/octet-stream'}],
    ['music-loop.mp3',{mime:'text/html',body:login}],
    ['rotate.wav',{mime:'audio/wav',body:login}],
    ['music-loop.mp3',{mime:'audio/mpeg',body:login}],
    ['credits.json',{mime:'application/json',body:login}],
    ['LICENSES.txt',{mime:'text/plain',body:login}],
  ]){
    const h=workerHarness();
    h.state.fetcher=async req=>responseFor(req.url,new URL(req.url).pathname==='/games/spinrealm/audio/'+file?override:{});
    await assert.rejects(()=>h.dispatch('install'),undefined,file);
    assert.equal(h.stores.size,0,'failed audio must not leave a partial version cache');
    assert.equal(h.state.skips,0);
    assert.ok(h.broadcasts.some(message=>message.type==='SRG_OFFLINE_ERROR'));
  }
});

test('online authorization responses and HTTP failures are returned instead of the cached game', async () => {
  const h = workerHarness();
  await h.dispatch('install');
  for (const overrides of [
    { body: '<html><body>Sign in required</body></html>' },
    { status: 403, body: 'Forbidden', mime: 'text/plain' },
    { redirected: true, url: ORIGIN + '/signin-with-chatgpt', body: 'Redirected sign in' },
  ]) {
    h.state.fetcher = async req => responseFor(req.url, overrides);
    const { response } = await h.dispatch('fetch', { request: request('/games/spinrealm/') });
    assert.equal(await response.text(), overrides.body);
    assert.equal(response.status, overrides.status || 200);
  }
});

test('an installed page and its modules stay on one cache version until update acceptance', async () => {
  const h = workerHarness();
  await h.dispatch('install');
  h.state.fetcher = async req => responseFor(req.url, { body: '<body data-srg-page="platform">new-version</body>' });
  const { response } = await h.dispatch('fetch', { request: request('/') });
  assert.match(await response.text(), /installed-platform/);
  const firstCache = [...h.stores.values()][0];
  firstCache.delete(ORIGIN + '/games/spinrealm/engine.mjs');
  assert.equal((await h.message({ type: 'SRG_OFFLINE_STATUS' })).ready, false, 'evicted modules must revoke offline-ready status');
});

test('updates are explicit, platform-only, blocked by any game tab, and require a complete new shell', async () => {
  const h = workerHarness();
  await h.dispatch('install');
  const type = 'SRG_ACTIVATE_UPDATE';
  assert.equal((await h.message({ type }, ORIGIN + '/games/spinrealm/')).accepted, false);
  assert.equal((await h.message({ type }, 'https://outside.example/')).accepted, false);
  h.state.windows.push({ url: ORIGIN + '/games/spinrealm/', postMessage() {} });
  const blocked = await h.message({ type });
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.reason, 'game-open');
  assert.equal(h.state.skips, 0);
  h.state.windows.pop();
  assert.equal((await h.message({ type })).accepted, true);
  assert.equal(h.state.skips, 1);
  [...h.stores.values()][0].delete(ORIGIN + '/app.mjs');
  assert.equal((await h.message({ type })).accepted, false);
  assert.equal(h.state.skips, 1);
});

class Hub {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) || []) listener(event); return true; }
  async emit(type, data = {}) { await Promise.all((this.listeners.get(type) || []).map(fn => fn({ type, ...data }))); }
}
function pageHarness(page = 'platform', { deferStatus = false } = {}) {
  const install = Object.assign(new Hub(), { hidden: false, disabled: false, dataset: {} });
  const update = Object.assign(new Hub(), { hidden: false, disabled: false, dataset: {} });
  const updateBanner = { hidden: true };
  const offlineLabel = { textContent: '' };
  const notices = [];
  const window = Object.assign(new Hub(), { isSecureContext: true });
  window.addEventListener('srg:notice', event => notices.push(event.detail.message));
  let resolveReady, resolveStatusRequested;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const statusRequested = new Promise(resolve => { resolveStatusRequested = resolve; });
  window.addEventListener('srg:offline-status', event => {
    if (event.detail.ready === true) resolveReady();
  });
  const state = { reloads: 0, updateMessages: 0 };
  const serviceWorker = new Hub();
  const pendingStatus = [];
  const active = { postMessage(message, ports) {
    const reply = () => ports[0].postMessage({ ready: true, version: 'test' });
    if (deferStatus) pendingStatus.push(reply); else reply();
    resolveStatusRequested();
  } };
  const waiting = { postMessage(message, ports) {
    state.updateMessages++;
    ports[0].postMessage({ accepted: true });
  } };
  const registration = Object.assign(new Hub(), { active, waiting, installing: null });
  serviceWorker.controller = active;
  serviceWorker.register = async () => registration;
  const location = { pathname: page === 'platform' ? '/' : '/games/spinrealm/', reload() { state.reloads++; } };
  const document = {
    body: { dataset: { srgPage: page } }, documentElement: { dataset: {} },
    getElementById(id) { return { installApp: install, applyUpdate: update, updateBanner, offlineState: offlineLabel }[id] || null; },
  };
  const navigator = { serviceWorker, userAgent: 'test', platform: 'test', maxTouchPoints: 0 };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } }
  vm.runInNewContext(clientSource, { document, window, navigator, location, matchMedia: () => ({ matches: false }), CustomEvent, MessageChannel, setTimeout, clearTimeout, console });
  return {
    state, serviceWorker, update, updateBanner, offlineLabel, document, notices, ready, statusRequested,
    releaseStatus() { for (const reply of pendingStatus.splice(0)) reply(); },
  };
}

test('page does not reload on worker takeover; only the tab accepting an update reloads', { timeout: 2000 }, async () => {
  const h = pageHarness();
  await h.ready;
  assert.equal(h.updateBanner.hidden, false, 'the update button must not remain hidden by its parent');
  assert.equal(h.offlineLabel.textContent, '離線資源已就緒');
  await h.serviceWorker.emit('controllerchange');
  assert.equal(h.state.reloads, 0);
  assert.equal(h.state.updateMessages, 0);
  await h.update.emit('click');
  assert.equal(h.state.updateMessages, 1);
  await h.serviceWorker.emit('controllerchange');
  await h.serviceWorker.emit('controllerchange');
  assert.equal(h.state.reloads, 1);
});

test('a game page cannot request or reload into an update', { timeout: 2000 }, async () => {
  const h = pageHarness('spinrealm');
  await h.ready;
  await h.update.emit('click');
  await h.serviceWorker.emit('controllerchange');
  assert.equal(h.state.updateMessages, 0);
  assert.equal(h.state.reloads, 0);
  assert.ok(h.notices.some(message => message.includes('結束這局')));
});

test('offline preparation errors visibly revoke ready state', { timeout: 2000 }, async () => {
  const h = pageHarness();
  await h.ready;
  await h.serviceWorker.emit('message', { data: { type: 'SRG_OFFLINE_ERROR' } });
  assert.equal(h.document.documentElement.dataset.offlineReady, 'false');
  assert.equal(h.offlineLabel.textContent, '離線資源尚未就緒');
  assert.ok(h.notices.some(message => message.includes('沒有完整儲存')));
});

test('UI waits for the worker cache verdict rather than guessing readiness from elapsed time', { timeout: 2000 }, async () => {
  const h = pageHarness('platform', { deferStatus: true });
  await h.statusRequested;
  assert.equal(h.document.documentElement.dataset.offlineReady, 'false');
  assert.equal(h.offlineLabel.textContent, '離線資源尚未就緒');
  assert.equal(h.notices.some(message => message.includes('離線資源已儲存')), false);
  h.releaseStatus();
  await h.ready;
  assert.equal(h.document.documentElement.dataset.offlineReady, 'true');
  assert.equal(h.offlineLabel.textContent, '離線資源已就緒');
});

test('manifest uses root scope and real local PNG icon sizes', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/');
  for (const size of [192, 512]) {
    const png = await fs.readFile(new URL(`../dist/assets/icon-${size}.png`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.ok(manifest.icons.some(icon => icon.src === `/assets/icon-${size}.png` && icon.sizes === `${size}x${size}`));
  }
});
