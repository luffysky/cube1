/* Original SnowRealm Games offline shell. No libraries or runtime cache rules. */
// Bump VERSION whenever a precached file changes. Install is all-or-nothing.
const VERSION = '2026-11-19-v14';
const CACHE_PREFIX = 'snowrealm-games-shell-';
const CACHE_NAME = CACHE_PREFIX + VERSION;

const PAGE_MARKERS = new Map([
  ['/index.html', 'platform'],
  ['/games/spinrealm/index.html', 'spinrealm'],
  ['/games/52hunt/index.html', '52hunt'],
  ['/games/next-floor/index.html', 'next-floor'],
]);
const AUDIO_ASSETS = [
  'move.wav', 'rotate.wav', 'hold.wav', 'drop.wav', 'clear.wav', 'spin.wav',
  'incoming.wav', 'win.wav', 'over.wav', 'item.wav', 'music-loop.mp3',
  'credits.json', 'LICENSES.txt',
].map(name => '/games/spinrealm/audio/' + name);
const ASSETS = [
  '/styles.css', '/app.mjs', '/pwa.mjs', '/member-platform.mjs', '/manifest.webmanifest',
  '/assets/icon-192.png', '/assets/icon-512.png',
  '/assets/realm-mark.svg', '/assets/spinrealm-cover.svg', '/assets/brickduel-cover.svg',
  '/assets/hunt-cover.svg', '/assets/floor-cover.svg',
  '/games/spinrealm/styles.css', '/games/spinrealm/arena-layout.css', '/games/spinrealm/app.mjs',
  '/games/spinrealm/engine.mjs', '/games/spinrealm/input.mjs',
  '/games/spinrealm/bot.mjs', '/games/spinrealm/combat.mjs',
  '/games/spinrealm/party.mjs', '/games/spinrealm/sound.mjs',
  '/games/spinrealm/icon.svg', '/games/spinrealm/platform-bridge.mjs',
  '/games/spinrealm/appearance.mjs',
  '/games/spinrealm/appearance.css',
  '/games/spinrealm/i18n.mjs',
  '/games/spinrealm/config.mjs',
  '/games/spinrealm/catalog.mjs',
  '/games/spinrealm/member-client.mjs',
  '/games/spinrealm/member-ui.mjs',
  '/games/spinrealm/member.css',
  '/games/spinrealm/ranked-client.mjs',
  '/games/spinrealm/gamepad.mjs',
  '/games/spinrealm/local-stats.mjs',
  '/games/spinrealm/prediction.mjs',
  '/games/spinrealm/vendor/neon-auth.mjs',
  '/games/spinrealm/locales/members.mjs',
  '/games/spinrealm/locales/ko.mjs',
  '/games/spinrealm/locales/zh-CN.mjs',
  '/games/spinrealm/locales/catalog.mjs',
  '/games/spinrealm/locales/zh-TW.mjs',
  '/games/spinrealm/locales/platform.mjs',
  '/games/spinrealm/locales/en.mjs',
  '/games/spinrealm/locales/ja.mjs',
  '/games/spinrealm/locales/game.mjs',
  '/games/spinrealm/locales/core.mjs',
  '/games/spinrealm/locales/dynamic.mjs',
  ...AUDIO_ASSETS,
];
const ENTRIES = [...PAGE_MARKERS.keys(), ...ASSETS];
const ASSET_SET = new Set(ASSETS);
const PAGE_ALIASES = new Map();
for (const canonical of PAGE_MARKERS.keys()) {
  const directory = canonical.slice(0, -'index.html'.length);
  PAGE_ALIASES.set(canonical, canonical);
  PAGE_ALIASES.set(directory, canonical);
  if (directory !== '/') PAGE_ALIASES.set(directory.slice(0, -1), canonical);
}

function routeFor(request) {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  // Queries may contain session/callback data. They never enter the offline shell.
  if (url.origin !== self.location.origin || url.search) return null;
  if (request.headers.has('range')) {
    // Audio players may request byte ranges even after the full file is cached.
    // HTML, unknown media paths, and every other asset keep the original bypass.
    return ASSET_SET.has(url.pathname) && /\.(?:mp3|wav)$/.test(url.pathname)
      ? { kind: 'audio-range', path: url.pathname } : null;
  }
  const page = PAGE_ALIASES.get(url.pathname);
  if (request.mode === 'navigate' && page) return { kind: 'page', path: page };
  if (ASSET_SET.has(url.pathname)) return { kind: 'asset', path: url.pathname };
  return null;
}

function expectedMime(path) {
  if (PAGE_MARKERS.has(path)) return /^text\/html(?:\s*;|$)/i;
  if (path.endsWith('.css')) return /^text\/css(?:\s*;|$)/i;
  if (path.endsWith('.mjs')) return /^(?:text|application)\/(?:javascript|ecmascript|x-javascript)(?:\s*;|$)/i;
  if (path.endsWith('.svg')) return /^image\/svg\+xml(?:\s*;|$)/i;
  if (path.endsWith('.png')) return /^image\/png(?:\s*;|$)/i;
  if (path.endsWith('.wav')) return /^audio\/(?:wav|wave|x-wav|vnd\.wave)(?:\s*;|$)/i;
  if (path.endsWith('.mp3')) return /^audio\/mpeg(?:\s*;|$)/i;
  if (path.endsWith('.txt')) return /^text\/plain(?:\s*;|$)/i;
  if (path.endsWith('.json')) return /^application\/json(?:\s*;|$)/i;
  return /^application\/(?:manifest\+json|json)(?:\s*;|$)/i;
}

async function validAudioHeader(response, path) {
  // MIME alone cannot distinguish a real sound from a mislabeled login page.
  // This checks container headers, not full audio decoding or audible quality.
  const bytes = new Uint8Array(await response.clone().arrayBuffer());
  if (path.endsWith('.wav')) {
    return bytes.length >= 44 && String.fromCharCode(...bytes.subarray(0,4)) === 'RIFF' &&
      String.fromCharCode(...bytes.subarray(8,12)) === 'WAVE';
  }
  const id3 = bytes.length >= 14 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 &&
    [2,3,4].includes(bytes[3]) && bytes[4] !== 0xff && bytes.subarray(6,10).every(value => value < 128);
  const mpegFrame = bytes.length >= 4 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 &&
    (bytes[1] & 0x18) !== 0x08 && (bytes[1] & 0x06) !== 0 &&
    (bytes[2] & 0xf0) !== 0xf0 && (bytes[2] & 0x0c) !== 0x0c;
  return id3 || mpegFrame;
}

async function safeResponse(response, path, allowAlias = false) {
  if (!response || response.status !== 200 || response.redirected ||
      ['opaque', 'opaqueredirect', 'error'].includes(response.type)) return false;
  let finalUrl;
  try { finalUrl = new URL(response.url); } catch { return false; }
  if (finalUrl.origin !== self.location.origin || finalUrl.search) return false;
  const finalPath = allowAlias ? (PAGE_ALIASES.get(finalUrl.pathname) || finalUrl.pathname) : finalUrl.pathname;
  if (finalPath !== path || !expectedMime(path).test(response.headers.get('content-type') || '')) return false;
  if (PAGE_MARKERS.has(path)) {
    const html = await response.clone().text();
    // A same-URL 200 login page is still not one of our game pages.
    const marker = PAGE_MARKERS.get(path);
    return new RegExp(`<body\\b[^>]*\\bdata-srg-page\\s*=\\s*["']${marker}["'][^>]*>`, 'i').test(html);
  }
  if (path.endsWith('.wav') || path.endsWith('.mp3')) return validAudioHeader(response,path);
  if (path.endsWith('.mjs') || path.endsWith('.css') || path.endsWith('.webmanifest') || path.endsWith('.json') || path.endsWith('.txt')) {
    const text = await response.clone().text();
    const start = text.slice(0, 1024).trimStart();
    if (/^(?:<!doctype\s+html|<html\b|<body\b)/i.test(start)) return false;
    if (path.endsWith('.json') || path.endsWith('.webmanifest')) {
      try { JSON.parse(text); } catch { return false; }
    }
  }
  return true;
}

async function broadcast(message) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) client.postMessage(message);
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  try {
    // A small bounded pool keeps install quick without flooding a private gate.
    let cursor = 0;
    const fetchNext = async () => {
      while (cursor < ENTRIES.length) {
        const path = ENTRIES[cursor++];
        const request = new Request(new URL(path, self.location.origin), {
          credentials: 'same-origin', cache: 'reload', redirect: 'follow',
        });
        const response = await fetch(request);
        if (!await safeResponse(response, path)) throw new Error('An offline resource could not be verified.');
        await cache.put(path, response);
      }
    };
    const attempts = await Promise.allSettled(Array.from({ length: 4 }, fetchNext));
    const failure = attempts.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  } catch (error) {
    await caches.delete(CACHE_NAME);
    await broadcast({ type: 'SRG_OFFLINE_ERROR' });
    throw error;
  }
}

async function offlineStatus() {
  const cache = await caches.open(CACHE_NAME);
  for (const path of ENTRIES) {
    const cached = await cache.match(path);
    if (!cached || !await safeResponse(cached, path)) return { ready: false, version: VERSION };
  }
  return { ready: true, version: VERSION };
}

async function navigation(request, path) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    // Preserve sign-in redirects, access denials, and HTTP errors. An online
    // authentication response must not be replaced by a cached game page.
    if (!await safeResponse(response, path, true)) return response;
    // Keep HTML and JS from the same installed shell version until an accepted
    // update activates. Never hot-replace just the document in the old cache.
    return await cache.match(path) || response;
  } catch {
    const cached = await cache.match(path);
    if (cached && await safeResponse(cached, path)) return cached;
    return new Response('目前沒有完整的離線頁面。請連線後重新開啟 SnowRealm Games。', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

async function asset(request, path) {
  const cached = await (await caches.open(CACHE_NAME)).match(path);
  if (cached) return cached;
  // Do not silently build a mixed-version runtime cache after eviction.
  return fetch(request);
}

function singleByteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || !size) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start >= size || end < start) return null;
  }
  return { start, end };
}

async function audioRange(request, path) {
  const cached = await (await caches.open(CACHE_NAME)).match(path);
  // Never manufacture a 206 response from an unverified or partial cache entry.
  // Missing or invalid entries use the original network request, without caching it.
  if (!cached || !await safeResponse(cached, path)) return fetch(request);
  // A conditional range may refer to a different representation. Conservatively
  // ignore that range and return the complete verified installed representation.
  if (request.headers.has('if-range')) return cached;
  const body = await cached.arrayBuffer();
  const range = singleByteRange(request.headers.get('range'), body.byteLength);
  if (!range) {
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${body.byteLength}`, 'Accept-Ranges': 'bytes',
        'Content-Length': '0', 'Cache-Control': 'no-store',
      },
    });
  }
  const headers = new Headers(cached.headers);
  // Fetch exposes decoded bytes, so the synthesized response must not advertise
  // an encoding or transfer length belonging to the original wire response.
  headers.delete('content-encoding');
  headers.delete('transfer-encoding');
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${body.byteLength}`);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(range.end - range.start + 1));
  return new Response(body.slice(range.start, range.end + 1), {
    status: 206, statusText: 'Partial Content', headers,
  });
}

self.addEventListener('install', event => {
  event.waitUntil(precache());
  // Deliberately no skipWaiting(): a running match keeps its current version.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
    await broadcast({ type: 'SRG_WORKER_ACTIVE', version: VERSION });
  })());
});

self.addEventListener('fetch', event => {
  const route = routeFor(event.request);
  if (!route) return; // Includes /studio/, APIs, auth routes, and all external URLs.
  event.respondWith(route.kind === 'page' ? navigation(event.request, route.path)
    : route.kind === 'audio-range' ? audioRange(event.request, route.path) : asset(event.request, route.path));
});

self.addEventListener('message', event => {
  const reply = data => event.ports?.[0]?.postMessage(data);
  if (event.data?.type === 'SRG_OFFLINE_STATUS') {
    event.waitUntil(offlineStatus().then(reply).catch(() => reply({ ready: false, version: VERSION })));
  } else if (event.data?.type === 'SRG_ACTIVATE_UPDATE') {
    event.waitUntil((async () => {
      let requester;
      try { requester = new URL(event.source?.url); } catch { reply({ accepted: false, reason: 'invalid-client' }); return; }
      if (requester.origin !== self.location.origin || !['/', '/index.html'].includes(requester.pathname) || requester.search) {
        reply({ accepted: false, reason: 'return-to-platform' }); return;
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some(client => {
        const url = new URL(client.url);
        return url.origin === self.location.origin && url.pathname.startsWith('/games/');
      })) {
        reply({ accepted: false, reason: 'game-open' }); return;
      }
      if (!(await offlineStatus()).ready) { reply({ accepted: false, reason: 'cache-incomplete' }); return; }
      reply({ accepted: true });
      await self.skipWaiting();
    })());
  }
});
