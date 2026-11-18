'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { MIME } = require('../lib/local-server.cjs');
const { resolveConfig } = require('../lib/policy.cjs');

async function main() {
  const packageDir = path.resolve(__dirname, '..');
  const root = path.resolve(packageDir, '..', 'dist');
  const packageInfo = JSON.parse(await fs.readFile(path.join(packageDir, 'package.json'), 'utf8'));
  resolveConfig(JSON.parse(await fs.readFile(path.join(packageDir, 'desktop.config.json'), 'utf8')), packageInfo.version);
  const required = ['games/spinrealm/index.html', 'games/spinrealm/app.mjs', 'games/spinrealm/engine.mjs', 'games/spinrealm/styles.css', 'assets/icon-512.png'];
  for (const file of required) if (!(await fs.stat(path.join(root, file))).isFile()) throw new Error(`Missing required public asset: ${file}`);
  const entryHTML = await fs.readFile(path.join(root, 'games/spinrealm/index.html'), 'utf8');
  if (!/data-mode\s*=\s*["']practice["']/.test(entryHTML)) throw new Error('The bundled game no longer has the practice-mode control required by the desktop bootstrap');
  const manifest = [];
  async function visit(directory) {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, item.name);
      const relative = path.relative(root, full).split(path.sep).join('/');
      if (item.isSymbolicLink()) throw new Error(`Symlink is not allowed in bundled public assets: ${relative}`);
      if (item.name.startsWith('.') || /(?:^id_rsa$|\.pem$|\.key$|\.p12$|\.pfx$|\.sqlite$|\.db$|\.sql$|^credentials(?:\.|$)|^service-account(?:\.|$))/i.test(item.name)) {
        throw new Error(`Non-public filename in dist: ${relative}`);
      }
      if (item.isDirectory()) { await visit(full); continue; }
      if (!item.isFile() || !MIME[path.extname(item.name).toLowerCase()]) throw new Error(`Unsupported public asset: ${relative}`);
      const bytes = await fs.readFile(full);
      manifest.push({ path: relative, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    }
  }
  await visit(root);
  manifest.sort((a, b) => a.path.localeCompare(b.path));
  const result = { version: packageInfo.version, sourceCommit: process.env.GITHUB_SHA || null, assetRoot: 'resources/web', entry: 'games/spinrealm/index.html', files: manifest };
  await fs.writeFile(path.join(packageDir, 'build-info.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`Verified ${manifest.length} public files for resources/web; entry and icon exist. No symlinks or sensitive filenames.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
