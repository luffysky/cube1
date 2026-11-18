'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { startLocalServer } = require('../lib/local-server.cjs');
const { resolveConfig } = require('../lib/policy.cjs');

let temporary, root, service;
const config = resolveConfig(require('../desktop.config.json'), 'test');
before(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'spinrealm-desktop-test-'));
  root = path.join(temporary, 'public');
  await fs.mkdir(path.join(root, 'games', 'spinrealm'), { recursive: true });
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><html><body>Portal</body></html>');
  await fs.writeFile(path.join(root, 'games', 'spinrealm', 'index.html'), '<!doctype html><html><body>Practice</body></html>');
  await fs.writeFile(path.join(root, 'game.mjs'), 'export const ready = true;');
  await fs.writeFile(path.join(root, 'music.wav'), '0123456789');
  await fs.writeFile(path.join(root, 'empty.txt'), '');
  await fs.writeFile(path.join(root, '.env'), 'secret-not-public');
  await fs.writeFile(path.join(root, 'source.map'), 'internal source map');
  await fs.writeFile(path.join(temporary, 'outside.txt'), 'outside-secret');
  service = await startLocalServer({ rootDir: root, config, port: 0 });
});
after(async () => {
  if (service) await service.close();
  if (temporary) await fs.rm(temporary, { recursive: true, force: true });
});

function request(rawPath, { method = 'GET', headers = {} } = {}) {
  const url = new URL(service.origin);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port, path: rawPath, method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end();
  });
}

test('serves the bundled practice page with a CSP-constrained desktop bootstrap', async () => {
  const response = await request('/games/spinrealm/?mode=practice');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /^text\/html/);
  assert.equal(response.body.match(/\/__desktop__\/bootstrap\.mjs/g).length, 1);
  assert.match(response.headers['content-security-policy'], /script-src 'self'/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['cross-origin-resource-policy'], 'same-origin');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('returns safe module MIME, accurate HEAD lengths and empty-file responses', async () => {
  const module = await request('/game.mjs');
  assert.equal(module.status, 200);
  assert.match(module.headers['content-type'], /^text\/javascript/);
  const head = await request('/game.mjs', { method: 'HEAD' });
  assert.equal(head.body, '');
  assert.equal(Number(head.headers['content-length']), Buffer.byteLength(module.body));
  const empty = await request('/empty.txt');
  assert.equal(empty.status, 200); assert.equal(empty.body, '');
});

test('canonicalizes directory links without losing practice query parameters', async () => {
  const response = await request('/games/spinrealm?mode=practice');
  assert.equal(response.status, 308);
  assert.equal(response.headers.location, '/games/spinrealm/?mode=practice');
});

test('rejects traversal, double encoding, alternate separators, NUL and Windows alternate streams', async () => {
  for (const value of ['/../outside.txt', '/games/../../outside.txt', '/%2e%2e/outside.txt', '/%252e%252e/outside.txt', '/..%2foutside.txt', '/..%5coutside.txt', '/games\\..\\outside.txt', '/file.txt:stream', '/con.txt', '/COM1', '/%00file.txt', '/%zz', '//outside.txt', 'http://evil.test/']) {
    const response = await request(value);
    assert.equal(response.status, 400, value);
    assert(!response.body.includes('outside-secret'), value);
  }
});

test('blocks hidden files, unknown types and directory listings', async () => {
  assert.equal((await request('/.env')).status, 400);
  assert.equal((await request('/source.map')).status, 404);
  await fs.mkdir(path.join(root, 'empty-directory'));
  assert.equal((await request('/empty-directory/')).status, 404);
  assert.equal((await request('/not-found.js')).status, 404);
});

test('symlink escapes never return data outside the asset root', async t => {
  const outside = path.join(temporary, 'outside-directory');
  await fs.mkdir(outside); await fs.writeFile(path.join(outside, 'secret.txt'), 'outside-secret');
  try { await fs.symlink(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') return t.skip('Symlink creation is not permitted on this runner'); throw error; }
  const response = await request('/escape/secret.txt');
  assert.equal(response.status, 403);
  assert(!response.body.includes('outside-secret'));
});

test('rejects hostile Host and Origin headers including cross-site browser requests', async () => {
  for (const headers of [{ Host: 'evil.test' }, { Origin: 'https://evil.test' }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await request('/game.mjs', { headers })).status, 403);
  }
  assert.equal((await request('/game.mjs', { headers: { Origin: service.origin } })).status, 200);
});

test('is read-only and does not make service workers available', async () => {
  const post = await request('/game.mjs', { method: 'POST' });
  assert.equal(post.status, 405); assert.equal(post.headers.allow, 'GET, HEAD');
  assert.equal((await request('/sw.js')).status, 404);
  assert.equal((await request('/__desktop__/../desktop.config.json')).status, 400);
  assert.equal((await request('/__desktop__/secret.json')).status, 404);
});

test('exposes only public runtime metadata and the fixed bootstrap asset', async () => {
  const response = await request('/__desktop__/config.json');
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), config);
  assert.equal(JSON.parse(response.body).features.steamWallet, false);
  assert.equal(JSON.parse(response.body).apiBaseUrl, config.apiBaseUrl);
  assert.equal(JSON.parse(response.body).features.onlineApi, true);
  const bootstrap = await request('/__desktop__/bootstrap.mjs');
  assert.equal(bootstrap.status, 200);
  assert.match(bootstrap.headers['content-type'], /^text\/javascript/);
});

test('supports bounded media byte ranges and rejects malformed or out-of-bounds ranges', async () => {
  const slice = await request('/music.wav', { headers: { Range: 'bytes=2-5' } });
  assert.equal(slice.status, 206); assert.equal(slice.body, '2345');
  assert.equal(slice.headers['content-range'], 'bytes 2-5/10');
  assert.equal((await request('/music.wav', { headers: { Range: 'bytes=-3' } })).body, '789');
  assert.equal((await request('/music.wav', { headers: { Range: 'bytes=8-' } })).body, '89');
  for (const range of ['bytes=10-20', 'bytes=8-2', 'bytes=0-1,4-5', 'bytes=-0', 'bytes=-', 'items=1-2', 'bytes=9007199254740992-']) {
    assert.equal((await request('/music.wav', { headers: { Range: range } })).status, 416, range);
  }
  const head = await request('/music.wav', { method: 'HEAD', headers: { Range: 'bytes=2-5' } });
  assert.equal(head.status, 200); assert.equal(head.headers['content-length'], '10');
});

test('does not silently reuse a port owned by another process', async () => {
  await assert.rejects(startLocalServer({ rootDir: root, config, port: Number(new URL(service.origin).port) }), { code: 'EADDRINUSE' });
});
