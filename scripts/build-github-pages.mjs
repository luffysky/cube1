#!/usr/bin/env node
/** Package the existing static site for a GitHub project path without changing dist/. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const PROJECT_ROOT=fileURLToPath(new URL('../',import.meta.url));
const INPUT=path.join(PROJECT_ROOT,'dist');
const OUTPUT=path.join(PROJECT_ROOT,'release-web');
const TEXT_TYPES=new Set(['.html','.css','.mjs','.js','.webmanifest']);
const ROOT_LITERAL_FILES=new Set(['app.mjs','pwa.mjs','sw.js','games/spinrealm/platform-bridge.mjs']);
const LOCAL_PREFIXES=['/assets/','/games/','/studio/','/player/'];
const LOCAL_ROOT_FILES=new Set(['/index.html','/styles.css','/app.mjs','/pwa.mjs','/member-platform.mjs','/sw.js','/manifest.webmanifest','/favicon.ico']);
const ORIGIN='https://pages.example.test';

export function normalizeBase(value='/cube1/'){
  if(typeof value!=='string')throw new TypeError('The base path must be a string.');
  const base=value===''?'/':value.endsWith('/')?value:value+'/';
  if(!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(base)||base.split('/').some(segment=>segment==='.'||segment==='..'))throw new Error('Use a local base path such as /cube1/ or /.');
  return base;
}
function knownLocalUrl(value){
  if(!value.startsWith('/')||value.startsWith('//'))return false;
  const pathname=value.split(/[?#]/,1)[0];
  return pathname==='/'||LOCAL_ROOT_FILES.has(pathname)||LOCAL_PREFIXES.some(prefix=>pathname.startsWith(prefix)||pathname===prefix.slice(0,-1));
}
export function rewriteLocalUrl(value,base){return base!=='/'&&knownLocalUrl(value)?base+value.slice(1):value;}
function rewriteCss(source,base){return source.replace(/url\(\s*(['"]?)(\/[^'"\s)]+)\1\s*\)/g,(_all,quote,url)=>`url(${quote}${rewriteLocalUrl(url,base)}${quote})`);}
function rewriteHtml(source,base){
  return rewriteCss(source.replace(/((?<![\w:-])(?:href|src|poster|action)\s*=\s*)(["'])(\/[^"']*)\2/gi,(_all,prefix,quote,url)=>prefix+quote+rewriteLocalUrl(url,base)+quote),base);
}
function rewriteJs(source,base,relative){
  // The SDK owns its own authentication paths. Do not alter vendored code.
  if(relative.includes('/vendor/'))return source;
  return source.replace(/(['"`])(\/[^'"`\r\n]*)\1/g,(all,quote,value,offset)=>{
    if(value==='/'&&!ROOT_LITERAL_FILES.has(relative))return all;
    // This test prevents the empty origin alias. It is not a navigation URL.
    // Keep it so /cube1 itself also becomes a canonical platform alias.
    if(relative==='sw.js'&&value==='/'&&/directory\s*!==\s*$/.test(source.slice(Math.max(0,offset-32),offset)))return all;
    return quote+rewriteLocalUrl(value,base)+quote;
  });
}
function rewriteManifest(source,base){
  const value=JSON.parse(source);for(const key of ['id','start_url','scope'])if(typeof value[key]==='string')value[key]=rewriteLocalUrl(value[key],base);
  for(const icon of [...(value.icons||[]),...(value.screenshots||[])])if(typeof icon.src==='string')icon.src=rewriteLocalUrl(icon.src,base);
  for(const shortcut of value.shortcuts||[]){if(shortcut.url)shortcut.url=rewriteLocalUrl(shortcut.url,base);for(const icon of shortcut.icons||[])if(icon.src)icon.src=rewriteLocalUrl(icon.src,base);}
  return JSON.stringify(value,null,2)+'\n';
}
export function rewriteText(source,relative,base){
  if(relative.endsWith('.html'))return rewriteHtml(source,base);
  if(relative.endsWith('.css'))return rewriteCss(source,base);
  if(relative.endsWith('.webmanifest'))return rewriteManifest(source,base);
  if(/\.(?:mjs|js)$/.test(relative))return rewriteJs(source,base,relative);
  return source;
}
async function collect(directory,relative=''){
  const result=[];
  for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    if(entry.isSymbolicLink())throw new Error(`Symlinks are not allowed in the Pages artifact: ${path.join(relative,entry.name)}`);
    if(entry.name.startsWith('.'))continue;
    const name=path.posix.join(relative,entry.name),file=path.join(directory,entry.name);
    if(entry.isDirectory())result.push(...await collect(file,name));else if(entry.isFile())result.push({relative:name,file});else throw new Error(`Unsupported artifact entry: ${name}`);
  }
  return result;
}
function protectedLiterals(source){
  return [...source.matchAll(/(['"`])((?:https?:\/\/|\/v1\/|\/api\/)[^'"`\r\n]*)\1/g)].map(match=>match[2]).sort();
}
function localReferences(source,relative){
  const refs=[];
  if(relative.endsWith('.html'))for(const match of source.matchAll(/(?<![\w:-])(?:href|src|poster|action)\s*=\s*(["'])([^"']*)\1/gi))refs.push(match[2]);
  if(/\.(?:css|html)$/.test(relative))for(const match of source.matchAll(/url\(\s*(['"]?)([^'"\s)]+)\1\s*\)/g))refs.push(match[2]);
  if(/\.(?:mjs|js)$/.test(relative)&&!relative.includes('/vendor/')){
    for(const match of source.matchAll(/\b(?:import|export)\s+(?:(?:[^;\n]*?)\s+from\s*)?['"]([^'"]+)['"]/g))refs.push(match[1]);
    for(const match of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g))refs.push(match[1]);
  }
  return refs;
}
function relativeTarget(url,relative,base){
  if(!url||url.startsWith('#')||/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url))return null;
  const resolved=new URL(url,new URL(base+relative,ORIGIN));
  if(resolved.origin!==ORIGIN)return null;
  if(!resolved.pathname.startsWith(base))throw new Error(`Path escapes ${base}: ${relative} -> ${url}`);
  let local=decodeURIComponent(resolved.pathname.slice(base.length));
  if(!local||local.endsWith('/'))local+='index.html';
  return local;
}
function routeSnapshot(workerSource,base){
  const listeners=new Map();const context=vm.createContext({URL,Request,Response,Headers,Map,Set,console,self:{location:{origin:ORIGIN},addEventListener:(type,fn)=>listeners.set(type,fn)}});
  vm.runInContext(workerSource+'\n;globalThis.__pages={entries:[...ENTRIES],prefix:CACHE_PREFIX,version:VERSION,routeFor};',context,{timeout:1000});
  const worker=context.__pages;
  const route=(pathname,{method='GET',mode='navigate',range}={})=>worker.routeFor({url:new URL(pathname,ORIGIN).href,method,mode,headers:new Headers(range?{range}:{})});
  for(const pathname of [base,base+'index.html',base==='/'?'/':base.slice(0,-1)])assert.equal(route(pathname)?.path,base+'index.html',`Platform alias ${pathname}`);
  for(const pathname of [base+'games/spinrealm/',base+'games/spinrealm',base+'games/spinrealm/index.html'])assert.equal(route(pathname)?.path,base+'games/spinrealm/index.html',`Game alias ${pathname}`);
  for(const pathname of ['/v1/profile','/api/auth/session',base+'studio/',base+'?token=private',base+'games/spinrealm/?mode=ranked','https://auth.example.test/api/auth/get-session'])assert.equal(route(pathname),null,`Do not cache ${pathname}`);
  assert.equal(route(base,{method:'POST'}),null);
  assert.equal(route(base+'games/spinrealm/audio/music-loop.mp3',{mode:'cors',range:'bytes=0-100'})?.kind,'audio-range');
  if(base!=='/'){assert.equal(route('/'),null);assert.equal(route('/games/spinrealm/'),null);}
  return worker;
}
export async function validateRelease(directory,base){
  const files=await collect(directory),names=new Set(files.map(file=>file.relative));let references=0;
  assert.ok(names.has('index.html'),'Missing home page');assert.ok(names.has('games/spinrealm/index.html'),'Missing game page');
  for(const {file,relative}of files){
    if(!TEXT_TYPES.has(path.extname(relative)))continue;
    const source=await fs.readFile(file,'utf8');
    if(/\.(?:mjs|js)$/.test(relative)){
      const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
      assert.equal(syntax.status,0,`Invalid generated JavaScript: ${relative}\n${syntax.stderr||''}`);
    }
    for(const ref of localReferences(source,relative)){
      const target=relativeTarget(ref,relative,base);if(target!==null){assert.ok(names.has(target),`Missing target: ${relative} -> ${ref} (${target})`);references++;}
    }
    if(base!=='/'&&/\.(?:mjs|js)$/.test(relative)&&!relative.includes('/vendor/')){
      for(const match of source.matchAll(/(['"`])(\/[^'"`\r\n]*)\1/g)){
        const value=match[2];if(value==='/'&&!(relative==='pwa.mjs'||relative.endsWith('platform-bridge.mjs')))continue;
        assert.ok(!knownLocalUrl(value),`Unprefixed local path: ${relative} -> ${value}`);
      }
    }
  }
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.webmanifest'),'utf8'));
  for(const key of ['scope','id','start_url'])assert.equal(manifest[key],base,`Manifest ${key}`);
  for(const icon of manifest.icons||[])assert.ok(names.has(relativeTarget(icon.src,'manifest.webmanifest',base)),`Manifest icon ${icon.src}`);
  const pwa=await fs.readFile(path.join(directory,'pwa.mjs'),'utf8');
  assert.ok(pwa.includes(`register('${base}sw.js'`),'Wrong service-worker URL');assert.ok(pwa.includes(`scope: '${base}'`),'Wrong worker scope');
  const worker=routeSnapshot(await fs.readFile(path.join(directory,'sw.js'),'utf8'),base);
  for(const entry of worker.entries){assert.ok(entry.startsWith(base),`Offline entry outside base: ${entry}`);assert.ok(names.has(entry.slice(base.length)),`Missing offline entry: ${entry}`);}
  assert.ok(worker.prefix.startsWith('snowrealm-games-shell-pages-'),'Cache namespace must be scoped to the Pages artifact');
  return {files:files.length,references,offlineEntries:worker.entries.length,base,cache:worker.prefix+worker.version};
}
export function selfTest(){
  const base='/cube1/';
  assert.equal(normalizeBase('/cube1'),base);assert.equal(normalizeBase(''),'/');assert.throws(()=>normalizeBase('/../'));assert.throws(()=>normalizeBase('//evil.test/'));
  assert.equal(rewriteLocalUrl('/assets/a.png',base),'/cube1/assets/a.png');assert.equal(rewriteLocalUrl('/?filter=favorites#games',base),'/cube1/?filter=favorites#games');
  for(const url of ['/v1/profile','/api/auth/session','https://neon.example/api/auth','//neon.example/auth','./local.mjs','#games'])assert.equal(rewriteLocalUrl(url,base),url);
  const html='<a href="/#games">Go</a><script src="/app.mjs"></script><a href="https://auth.example/">Auth</a>';
  assert.equal(rewriteText(html,'index.html',base),'<a href="/cube1/#games">Go</a><script src="/cube1/app.mjs"></script><a href="https://auth.example/">Auth</a>');
  const code="import '/pwa.mjs';const endpoint='/v1/profile';const auth='https://auth.example/api/auth';const home='/';";
  const result=rewriteText(code,'games/spinrealm/platform-bridge.mjs',base);assert.ok(result.includes("import '/cube1/pwa.mjs'"));assert.ok(result.includes("home='/cube1/'"));assert.deepEqual(protectedLiterals(result),protectedLiterals(code));
  assert.equal(rewriteText(code,'games/spinrealm/vendor/neon-auth.mjs',base),code);
  assert.equal(rewriteText('a{background:url(/assets/a.svg)}','styles.css',base),'a{background:url(/cube1/assets/a.svg)}');
  assert.equal(rewriteText(result,'games/spinrealm/platform-bridge.mjs',base),result,'Build transformation must be idempotent');
  assert.equal(rewriteText("if(directory !== '/'){};['/','/index.html']",'sw.js',base),"if(directory !== '/'){};['/cube1/','/cube1/index.html']");
  return {checks:18,status:'passed'};
}
export async function buildPages({base='/cube1/'}={}){
  base=normalizeBase(base);selfTest();
  const files=await collect(INPUT),hash=createHash('sha256');hash.update(base);
  const snapshots=[];for(const item of files){const data=await fs.readFile(item.file);hash.update(item.relative);hash.update(data);snapshots.push({...item,data});}
  const fingerprint=hash.digest('hex').slice(0,12),scopeHash=createHash('sha256').update(base).digest('hex').slice(0,10);
  const staging=path.join(PROJECT_ROOT,`.release-web-${process.pid}`);await fs.rm(staging,{recursive:true,force:true});await fs.mkdir(staging,{recursive:true});
  try{
    for(const {relative,data}of snapshots){
      const destination=path.join(staging,relative);await fs.mkdir(path.dirname(destination),{recursive:true});let output=data;
      if(TEXT_TYPES.has(path.extname(relative))){
        const source=data.toString('utf8');let transformed=rewriteText(source,relative,base);
        assert.deepEqual(protectedLiterals(transformed),protectedLiterals(source),`API/auth URL changed: ${relative}`);
        if(relative==='sw.js'){
          assert.match(transformed,/const CACHE_PREFIX\s*=\s*['"][^'"]+['"]/);assert.match(transformed,/const VERSION\s*=\s*['"][^'"]+['"]/);
          transformed=transformed.replace(/const CACHE_PREFIX\s*=\s*['"][^'"]+['"]/,`const CACHE_PREFIX = 'snowrealm-games-shell-pages-${scopeHash}-'`);
          transformed=transformed.replace(/const VERSION\s*=\s*(['"])([^'"]+)\1/,(_all,_quote,version)=>`const VERSION = '${version}-pages-${fingerprint}'`);
        }
        output=transformed;
      }
      await fs.writeFile(destination,output);
    }
    await fs.writeFile(path.join(staging,'.nojekyll'),'');
    const report=await validateRelease(staging,base);
    await fs.writeFile(path.join(staging,'build-info.json'),JSON.stringify({format:1,...report,fingerprint},null,2)+'\n');
    await fs.rm(OUTPUT,{recursive:true,force:true});await fs.rename(staging,OUTPUT);return {...report,fingerprint,output:'release-web/'};
  }catch(error){await fs.rm(staging,{recursive:true,force:true});throw error;}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2);let base=process.env.PAGES_BASE_PATH??'/cube1/',check=false,testsOnly=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--self-test')testsOnly=true;else if(arg==='--check')check=true;else if(arg==='--base')base=args[++i];else if(arg.startsWith('--base='))base=arg.slice(7);else throw new Error(`Unknown argument: ${arg}`);}
    console.log(JSON.stringify(testsOnly?selfTest():check?await validateRelease(OUTPUT,normalizeBase(base)):await buildPages({base}),null,2));
  }catch(error){console.error(`GitHub Pages packaging failed: ${error.message}`);process.exitCode=1;}
}
