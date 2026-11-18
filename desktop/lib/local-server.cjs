'use strict';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const { HOST, PORT, contentSecurityPolicy } = require('./policy.cjs');

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8'
});
const BOOTSTRAP_TAG = '<script type="module" src="/__desktop__/bootstrap.mjs"></script>';
const MAX_ASSET_BYTES = 64 * 1024 * 1024;

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function decodeAssetPath(rawURL) {
  if (typeof rawURL !== 'string' || rawURL.length > 4096 || !rawURL.startsWith('/') || rawURL.startsWith('//')) return null;
  const encoded = rawURL.split(/[?#]/, 1)[0];
  // Decode exactly once, and reject ambiguous encodings before URL normalization.
  if (/%(?:2f|5c)/i.test(encoded)) return null;
  let decoded;
  try { decoded = decodeURIComponent(encoded); } catch { return null; }
  if (/[\\%:\x00-\x1f\x7f]/.test(decoded)) return null;
  const parts = decoded.split('/').filter(Boolean);
  if (parts.some(part => part.startsWith('.') || part.endsWith('.') || part.endsWith(' ') || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part))) return null;
  return '/' + parts.join('/') + (decoded.endsWith('/') && parts.length ? '/' : '');
}

function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || '');
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

async function startLocalServer({ rootDir, config, bootstrapPath = path.join(__dirname, '..', 'renderer', 'bootstrap.mjs'), port = PORT }) {
  const root = await fs.realpath(rootDir);
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Bundled web root is not a directory');
  const bootstrap = await fs.readFile(bootstrapPath);
  const configBody = Buffer.from(JSON.stringify(config));
  let origin;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', contentSecurityPolicy(config));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), usb=(), payment=()');
    res.setHeader('Cache-Control', 'no-store');
    const reply = (status, message) => {
      const body = Buffer.from(message);
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (req.headers.host !== new URL(origin).host) return reply(403, 'Forbidden host');
    if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403, 'Cross-origin request blocked');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD'); return reply(405, 'Read-only asset server');
    }
    const pathname = decodeAssetPath(req.url);
    if (pathname === null) return reply(400, 'Invalid asset path');
    const send = (body, type) => {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (pathname === '/__desktop__/config.json') return send(configBody, MIME['.json']);
    if (pathname === '/__desktop__/bootstrap.mjs') return send(bootstrap, MIME['.mjs']);
    if (pathname.startsWith('/__desktop__/') || pathname === '/sw.js') return reply(404, 'Asset not available');

    let handle;
    try {
      let filename = path.resolve(root, '.' + pathname);
      if (!within(root, filename)) return reply(403, 'Asset not available');
      let real = await fs.realpath(filename);
      if (!within(root, real)) return reply(403, 'Asset not available');
      if ((await fs.stat(real)).isDirectory()) {
        if (!pathname.endsWith('/')) {
          const canonical = new URL(origin);
          canonical.pathname = pathname + '/';
          canonical.search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
          res.writeHead(308, { Location: canonical.pathname + canonical.search, 'Content-Length': 0 });
          return res.end();
        }
        filename = path.join(real, 'index.html');
        real = await fs.realpath(filename);
        if (!within(root, real)) return reply(403, 'Asset not available');
      }
      const type = MIME[path.extname(real).toLowerCase()];
      if (!type) return reply(404, 'Unsupported asset type');
      handle = await fs.open(real, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_ASSET_BYTES) { await handle.close(); handle = null; return reply(404, 'Asset not available'); }
      if (type === MIME['.html']) {
        let text = await handle.readFile('utf8'); await handle.close(); handle = null;
        if (!text.includes('/__desktop__/bootstrap.mjs')) text = /<\/body\s*>/i.test(text) ? text.replace(/<\/body\s*>/i, `${BOOTSTRAP_TAG}</body>`) : text + BOOTSTRAP_TAG;
        return send(Buffer.from(text), type);
      }
      res.setHeader('Accept-Ranges', 'bytes');
      let start = 0, end = stat.size - 1, status = 200;
      if (req.method === 'GET' && req.headers.range) {
        const range = byteRange(req.headers.range, stat.size);
        if (!range) { await handle.close(); handle = null; res.setHeader('Content-Range', `bytes */${stat.size}`); return reply(416, 'Invalid byte range'); }
        ({ start, end } = range); status = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      }
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': stat.size ? end - start + 1 : 0 });
      if (req.method === 'HEAD' || stat.size === 0) { await handle.close(); handle = null; return res.end(); }
      const stream = handle.createReadStream({ start, end, autoClose: true }); handle = null;
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      if (res.headersSent) return res.destroy();
      return reply(['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 403, 'Asset not available');
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 1_000;
  server.maxHeadersCount = 40;
  server.on('clientError', (_, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: HOST, port, exclusive: true }, () => {
      server.removeListener('error', reject);
      origin = `http://${HOST}:${server.address().port}`;
      resolve();
    });
  });
  return { origin, server, close: () => new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); }) };
}

module.exports = { startLocalServer, decodeAssetPath, byteRange, MIME };
