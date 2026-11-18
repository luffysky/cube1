'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveConfig, isAllowedExternalURL, isLocalURL, contentSecurityPolicy, isAllowedNetworkRequest, isAllowedDocumentPermission } = require('../lib/policy.cjs');
const raw = require('../desktop.config.json');

test('configuration exports only public fields, with unimplemented Steam gates disabled', () => {
  const config = resolveConfig({ ...raw, secretKey: 'do-not-export-this' }, 'test');
  assert.equal(config.steamAppId, null);
  assert.equal(config.defaultMode, 'practice');
  assert.equal(config.features.steamWallet, false);
  assert.equal(config.secretKey, undefined);
  assert(Object.isFrozen(config));
  assert(Object.isFrozen(config.features));
});

test('changing a flag cannot claim unimplemented Steam integration', () => {
  for (const feature of ['steamSdk', 'steamCloud', 'steamAchievements', 'steamFriends', 'steamWallet']) {
    assert.throws(() => resolveConfig({ ...raw, features: { [feature]: true } }), /not implemented/);
  }
  assert.throws(() => resolveConfig({ ...raw, steamAppId: 'YOUR_APP_ID' }), /positive numeric/);
  assert.throws(() => resolveConfig({ ...raw, apiBaseUrl: null, features: { onlineApi: true } }), /verified apiBaseUrl/);
});

test('configuration rejects unsafe origins and embedded credentials', () => {
  for (const authOrigin of ['http://auth.example.test', 'file:///etc/passwd', 'https://user:pass@auth.example.test', 'https://auth.example.test/path', 'https://auth.example.test?key=secret']) {
    assert.throws(() => resolveConfig({ ...raw, authOrigin }), /HTTPS|valid URL/);
  }
  assert.throws(() => resolveConfig({ ...raw, apiBaseUrl: 'javascript:alert(1)' }), /HTTPS/);
});

test('official external link allowlist has exact hosts and repository path boundaries', () => {
  for (const url of ['https://github.com/luffysky/cube1', 'https://github.com/luffysky/cube1/issues', 'https://partner.steamgames.com/doc/store/review_process', 'https://store.steampowered.com/steam_refunds/']) assert(isAllowedExternalURL(url), url);
  for (const url of ['file:///tmp/private', 'javascript:alert(1)', 'https://github.com.evil.test/luffysky/cube1', 'https://evil.test/?github.com/luffysky/cube1', 'https://github.com/luffysky/cube12', 'https://github.com/another/repo', 'https://u:p@github.com/luffysky/cube1', 'http://github.com/luffysky/cube1', 'https://store.steampowered.com/linkfilter/?url=https://evil.test']) assert.equal(isAllowedExternalURL(url), false, url);
});

test('local navigation is restricted to exactly the bound origin', () => {
  const origin = 'http://127.0.0.1:43671';
  assert(isLocalURL(origin + '/games/spinrealm/', origin));
  for (const url of ['http://127.0.0.1:43672/', 'http://localhost:43671/', 'http://127.0.0.1.evil.test:43671/', 'file:///games/spinrealm/', 'http://u:p@127.0.0.1:43671/']) assert.equal(isLocalURL(url, origin), false, url);
});

test('CSP permits local modules and known auth fetches, but no eval, remote scripts, frames or workers', () => {
  const csp = contentSecurityPolicy(resolveConfig(raw));
  assert(csp.includes("script-src 'self';"));
  assert(!csp.includes('unsafe-eval'));
  assert(csp.includes("worker-src 'none'"));
  assert(csp.includes("frame-src 'none'"));
  assert(csp.includes(raw.authOrigin));
});

test('document permissions allow only clipboard writes and fullscreen for a trusted main frame', () => {
  const origin = 'http://127.0.0.1:43671';
  const main = { isMainFrame: true, requestingUrl: origin + '/games/spinrealm/' };
  assert(isAllowedDocumentPermission('clipboard-sanitized-write', main, origin));
  assert(isAllowedDocumentPermission('fullscreen', main, origin));
  for (const permission of ['clipboard-read', 'deprecated-sync-clipboard-read', 'automatic-fullscreen', 'media', 'geolocation', 'fileSystem', 'openExternal', 'unknown']) {
    assert.equal(isAllowedDocumentPermission(permission, main, origin), false, permission);
  }
  assert.equal(isAllowedDocumentPermission('clipboard-sanitized-write', { ...main, isMainFrame: false }, origin), false);
  assert.equal(isAllowedDocumentPermission('clipboard-sanitized-write', { ...main, requestingUrl: 'https://evil.test' }, origin), false);
  assert.equal(isAllowedDocumentPermission('fullscreen', { isMainFrame: true }, origin), false);
});

test('network policy permits only verified API origins and intended request types', () => {
  const origin = 'http://127.0.0.1:43671';
  const config = resolveConfig(raw);
  assert(isAllowedNetworkRequest(origin + '/games/spinrealm/app.mjs', 'script', origin, config));
  assert(isAllowedNetworkRequest(raw.authOrigin + '/api/auth/get-session', 'xhr', origin, config));
  assert.equal(isAllowedNetworkRequest(raw.authOrigin + '/code.js', 'script', origin, config), false);
  assert.equal(isAllowedNetworkRequest('https://evil.test', 'xhr', origin, config), false);
  assert.equal(isAllowedNetworkRequest('file:///etc/passwd', 'other', origin, config), false);
  assert.equal(isAllowedNetworkRequest('data:text/html,<script>alert(1)</script>', 'mainFrame', origin, config), false);
  assert(isAllowedNetworkRequest('data:image/png;base64,AAAA', 'image', origin, config));
  assert.equal(config.features.onlineApi, true);
  assert(isAllowedNetworkRequest(config.apiBaseUrl + '/api/v1/me', 'xhr', origin, config));
  assert.equal(isAllowedNetworkRequest(config.apiBaseUrl + '/remote-code.mjs', 'script', origin, config), false);
  assert.equal(isAllowedNetworkRequest(new URL(config.apiBaseUrl).origin + '.evil.test/api/v1/me', 'xhr', origin, config), false);
  const offline = resolveConfig({ ...raw, features: { onlineApi: false } });
  assert.equal(isAllowedNetworkRequest(config.apiBaseUrl + '/api/v1/me', 'xhr', origin, offline), false);
  const online = resolveConfig({ ...raw, apiBaseUrl: 'https://api.example.test/v1', features: { onlineApi: true } });
  assert(isAllowedNetworkRequest('https://api.example.test/v1/me', 'xhr', origin, online));
  assert(isAllowedNetworkRequest('wss://api.example.test/live', 'webSocket', origin, online));
  assert.equal(isAllowedNetworkRequest('wss://api.example.test/live', 'webSocket', origin, config), false);
});
