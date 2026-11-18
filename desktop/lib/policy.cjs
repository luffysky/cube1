'use strict';

const HOST = '127.0.0.1';
const PORT = 43671;
const ENTRY_PATH = '/games/spinrealm/?desktop=1&mode=practice';
const STEAM_GATES = ['steamSdk', 'steamCloud', 'steamAchievements', 'steamFriends', 'steamWallet'];
const EXTERNAL_LINKS = Object.freeze([
  { origin: 'https://partner.steamgames.com', path: '/doc' },
  { origin: 'https://store.steampowered.com', path: '/steam_refunds' },
  { origin: 'https://help.steampowered.com', path: '/' },
  { origin: 'https://github.com', path: '/luffysky/cube1' }
]);

function httpsURL(value, name, originOnly = false) {
  if (typeof value !== 'string') throw new Error(`${name} must be a public HTTPS URL`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} is not a valid URL`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || (originOnly && url.pathname !== '/')) {
    throw new Error(`${name} must be HTTPS, without credentials, query or fragment`);
  }
  return originOnly ? url.origin : url.href.replace(/\/$/, '');
}

function resolveConfig(raw, version = 'development') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid desktop configuration');
  const features = { onlineApi: raw.features?.onlineApi === true };
  for (const gate of STEAM_GATES) {
    // A configuration checkbox must never masquerade as an implemented SDK.
    if (raw.features?.[gate] === true) throw new Error(`${gate} is not implemented in this desktop scaffold`);
    features[gate] = false;
  }
  const authOrigin = httpsURL(raw.authOrigin, 'authOrigin', true);
  const apiBaseUrl = raw.apiBaseUrl == null ? null : httpsURL(raw.apiBaseUrl, 'apiBaseUrl');
  if (features.onlineApi && !apiBaseUrl) throw new Error('onlineApi requires a verified apiBaseUrl');
  let steamAppId = raw.steamAppId ?? null;
  if (steamAppId !== null) {
    steamAppId = String(steamAppId);
    if (!/^[1-9]\d{0,9}$/.test(steamAppId)) throw new Error('steamAppId must be an assigned positive numeric App ID');
  }
  return Object.freeze({
    runtime: 'desktop', version, defaultMode: 'practice', authOrigin, apiBaseUrl,
    steamAppId, features: Object.freeze(features)
  });
}

function isLocalURL(value, origin) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && url.origin === origin && !url.username && !url.password;
  } catch { return false; }
}

function isAllowedExternalURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    return EXTERNAL_LINKS.some(rule => url.origin === rule.origin &&
      (rule.path === '/' || url.pathname === rule.path || url.pathname.startsWith(`${rule.path}/`)));
  } catch { return false; }
}

function connectionOrigins(config) {
  const origins = [config.authOrigin];
  if (config.features.onlineApi && config.apiBaseUrl) origins.push(new URL(config.apiBaseUrl).origin);
  return [...new Set(origins)];
}

function contentSecurityPolicy(config) {
  const origins = connectionOrigins(config);
  if (config.features.onlineApi && config.apiBaseUrl) origins.push(new URL(config.apiBaseUrl).origin.replace(/^https:/, 'wss:'));
  return [
    "default-src 'self'", "script-src 'self'",
    // Existing game styles are set through style elements / style properties.
    // Inline scripts and eval remain disallowed.
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    "font-src 'self' data:", "media-src 'self' blob:",
    `connect-src 'self' ${origins.join(' ')}`,
    "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
    "frame-src 'none'", "form-action 'self'", "worker-src 'none'", "manifest-src 'self'"
  ].join('; ');
}

function isAllowedNetworkRequest(value, resourceType, origin, config) {
  if (isLocalURL(value, origin)) return true;
  let url;
  try { url = new URL(value); } catch { return false; }
  if (['data:', 'blob:'].includes(url.protocol)) return ['image', 'media', 'font'].includes(resourceType);
  if (url.username || url.password) return false;
  if (url.protocol === 'https:' && resourceType === 'xhr') return connectionOrigins(config).includes(url.origin);
  if (url.protocol === 'wss:' && resourceType === 'webSocket' && config.features.onlineApi && config.apiBaseUrl) {
    return url.origin === new URL(config.apiBaseUrl).origin.replace(/^https:/, 'wss:');
  }
  return false;
}

function isAllowedDocumentPermission(permission, details, origin) {
  return ['clipboard-sanitized-write', 'fullscreen'].includes(permission) &&
    details?.isMainFrame === true && isLocalURL(details.requestingUrl, origin);
}

module.exports = { HOST, PORT, ENTRY_PATH, resolveConfig, isLocalURL, isAllowedExternalURL, contentSecurityPolicy, isAllowedNetworkRequest, isAllowedDocumentPermission };
