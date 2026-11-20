import {createRequire} from 'node:module';
import {copyFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const require=createRequire(new URL('../../server/api/package.json',import.meta.url));
const {build}=require('esbuild');
const here=path=>fileURLToPath(new URL(path,import.meta.url));
await mkdir(here('./build/assets/'),{recursive:true});
await Promise.all([
 copyFile(here('./index.html'),here('./build/assets/index.html')),
 copyFile(here('./admin.css'),here('./build/assets/admin.css')),
 copyFile(here('../../dist/assets/realm-mark.svg'),here('./build/assets/realm-mark.svg')),
 build({entryPoints:[here('./admin.mjs')],bundle:true,format:'esm',platform:'browser',
  outfile:here('./build/assets/admin.mjs')}),
 build({entryPoints:[here('./worker.mjs')],bundle:true,format:'esm',platform:'browser',
  nodePaths:[here('../../server/api/node_modules')],outfile:here('./build/worker.mjs')})
]);
