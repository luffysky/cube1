import {createRequire} from 'node:module';
const require=createRequire(new URL('../../server/api/package.json',import.meta.url));
const {build}=require('esbuild');
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=new URL('./build/',import.meta.url);
await mkdir(dir,{recursive:true});
await build({
  entryPoints:[fileURLToPath(new URL('./index.mjs',import.meta.url))],
  bundle:true,platform:'node',target:'node24',format:'esm',
  outfile:fileURLToPath(new URL('./build/index.mjs',import.meta.url)),
  banner:{js:"import{createRequire as ___cr}from'node:module';import{fileURLToPath as ___f}from'node:url';import{dirname as ___d}from'node:path';const require=___cr(import.meta.url);const __filename=___f(import.meta.url);const __dirname=___d(__filename);"},
  nodePaths:[fileURLToPath(new URL('../../server/api/node_modules',import.meta.url))],
  define:{__ENABLE_STAGING_BRICKDUEL_SYNC__:JSON.stringify(process.argv.includes('--enable-staging-brickduel-sync'))},
  external:['pg-native'],logLevel:'info'
});
