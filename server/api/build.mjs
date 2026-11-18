import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = new URL('./build/', import.meta.url);
await mkdir(output, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('./index.mjs', import.meta.url))],
  bundle: true, platform: 'node', target: 'node24', format: 'esm',
  outfile: fileURLToPath(new URL('index.mjs', output)),
  banner: { js: "import{createRequire as ___cr}from'node:module';import{fileURLToPath as ___f}from'node:url';import{dirname as ___d}from'node:path';const require=___cr(import.meta.url);const __filename=___f(import.meta.url);const __dirname=___d(__filename);" },
  external: ['pg-native'],
  logLevel: 'info',
});
