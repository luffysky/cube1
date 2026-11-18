import zhTW from './locales/zh-TW.mjs';
import zhCN from './locales/zh-CN.mjs';
import en from './locales/en.mjs';
import ja from './locales/ja.mjs';
import ko from './locales/ko.mjs';
import {CATALOG_ROWS,LOCALE_CODES} from './locales/catalog.mjs';

export const LOCALES=Object.freeze([
  Object.freeze({code:'zh-TW',label:'繁體中文',lang:'zh-Hant'}),
  Object.freeze({code:'zh-CN',label:'简体中文',lang:'zh-Hans'}),
  Object.freeze({code:'en',label:'English',lang:'en'}),
  Object.freeze({code:'ja',label:'日本語',lang:'ja'}),
  Object.freeze({code:'ko',label:'한국어',lang:'ko'}),
]);
export const availableLocales=LOCALES;
export const dictionaries=Object.freeze({'zh-TW':zhTW,'zh-CN':zhCN,en,ja,ko});
const STORAGE_KEY='snowrealm.locale.v1',listeners=new Set(),cache=new Map();
const textRecords=new WeakMap(),attributeRecords=new WeakMap();
const IGNORE='script,style,textarea,code,pre,svg,[contenteditable="true"],[translate="no"],[data-no-i18n],[data-locale-native]';
const ATTRIBUTES=['aria-label','aria-description','title','placeholder','alt','content','data-i18n'];
let locale=readLocale(),observer=null,observedRoot=null,queued=false;
const pending=new Set();

export function normalizeLocale(value){
  if(typeof value!=='string')return 'zh-TW';
  const code=value.trim().toLowerCase().replaceAll('_','-');
  if(code==='zh-hans'||code.startsWith('zh-hans-')||code==='zh-cn'||code==='zh-sg')return 'zh-CN';
  if(code==='zh'||code==='zh-hant'||code.startsWith('zh-hant-')||['zh-tw','zh-hk','zh-mo'].includes(code))return 'zh-TW';
  if(code==='ja'||code.startsWith('ja-'))return 'ja';if(code==='ko'||code.startsWith('ko-'))return 'ko';if(code==='en'||code.startsWith('en-'))return 'en';
  return 'zh-TW';
}
function readLocale(){try{const saved=globalThis.localStorage?.getItem(STORAGE_KEY);if(saved)return normalizeLocale(saved);}catch{}return normalizeLocale(globalThis.navigator?.language||'zh-TW');}
export function getLocale(){return locale;}
export function t(key,params={},language=locale){
  const code=normalizeLocale(language),value=dictionaries[code][key]??zhTW[key]??key;
  return String(value).replace(/\{([\w]+)\}/g,(token,name)=>Object.prototype.hasOwnProperty.call(params,name)?String(params[name]):token);
}
export function hasTranslation(key){return Object.prototype.hasOwnProperty.call(zhTW,key);}
export function subscribeLocale(listener){if(typeof listener!=='function')throw new TypeError('Listener required');listeners.add(listener);return()=>listeners.delete(listener);}
export const subscribe=subscribeLocale;
export function setLocale(value,{persist=true}={}){
  const next=normalizeLocale(value),changed=locale!==next;locale=next;cache.clear();
  if(persist)try{globalThis.localStorage?.setItem(STORAGE_KEY,locale);}catch{}
  if(globalThis.document?.documentElement){document.documentElement.lang=locale;document.documentElement.dataset.locale=locale;}
  if(observedRoot){pending.add(observedRoot);flush();}
  if(changed){for(const listener of listeners)listener(locale);if(globalThis.CustomEvent)globalThis.dispatchEvent?.(new CustomEvent('snowrealm:locale',{detail:{locale}}));}
  return locale;
}
const exact=new Map(),patterns=[];
const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const numericTokens=new Set(['seconds','count','lines','sent','incoming','cancelled','attack','energy','max','cost','score','best','before','after','coins','amount','pieces','playable']);
const actionValues=[...new Set(CATALOG_ROWS.filter(row=>row[0].startsWith('action.')).flatMap(row=>row.slice(1)))].sort((a,b)=>b.length-a.length).map(escapeRegex).join('|');
for(const row of CATALOG_ROWS){
  const[key,...values]=row;
  for(const text of values){
    if(typeof text!=='string')continue;
    if(!text.includes('{')){if(!exact.has(text))exact.set(text,key);continue;}
    const tokens=[...text.matchAll(/\{(\w+)\}/g)];if(!tokens.length)continue;
    let source='',last=0;const names=[];
    for(const token of tokens){const capture=numericTokens.has(token[1])?'([-+]?\\d+(?:[.,]\\d+)*)':token[1]==='action'?'('+actionValues+')':token[1]==='detail'?'(.*?)':'(.+?)';source+=escapeRegex(text.slice(last,token.index))+capture;names.push(token[1]);last=token.index+token[0].length;}
    source+=escapeRegex(text.slice(last));
    patterns.push({key,names,regex:new RegExp('^'+source+'$','u'),weight:text.replace(/\{\w+\}/g,'').length});
  }
}
patterns.sort((a,b)=>b.weight-a.weight);
const originalAliases={
  PLAYER:'game.playerEn','YOUR FIELD':'game.yourFieldEn',OPPONENT:'game.opponentEn',NEXT:'game.nextEn',HOLD:'game.holdEn',COMBO:'game.comboEn',READY:'game.readyEn',PAUSED:'game.pausedEn',FINISHED:'game.finishedEn',SOLO:'game.soloEn',
  'FIND YOUR FLOW':'game.findFlow','THE NEXT MOVE IS YOURS':'game.nextMove','EARLY PLAYTEST':'game.earlyPlaytest','THE SIGNATURE MOVE':'game.signatureEn','MAKE IT FEEL RIGHT':'game.feelRightEn','SOUND OF YOUR NEXT MOVE':'game.soundEn','ONE MORE ROTATION':'game.moreRotationEn','BEYOND THE NOSTALGIA':'game.beyondEn','MAKE YOUR NEXT MOVE':'game.makeMoveEn','TAKE YOUR TIME':'game.takeTimeEn','ONE LAST SPIN':'game.lastSpinEn','TAKE A BREATH':'game.breathEn','THAT’S THE FEELING':'game.feelingEn','RESET THE POSITION':'game.resetEn','ONE MORE TRY':'game.tryEn','KEEP THE GOOD MOVES':'game.keepMovesEn','EVENLY MATCHED':'game.evenEn','YOUR COUNTERPLAY':'game.counterEn','THE NEXT ONE IS YOURS':'game.nextYoursEn',
};
for(const[source,key]of Object.entries(originalAliases))exact.set(source,key);

/** Translate legacy engine text without modifying its simulation or event handlers. */
export function translate(input,language=locale,depth=0){
  if(typeof input!=='string'||!input.trim())return input;
  const code=normalizeLocale(language),cacheKey=code+'\0'+input;
  if(depth===0&&cache.has(cacheKey))return cache.get(cacheKey);
  const leading=input.match(/^\s*/)[0],trailing=input.match(/\s*$/)[0],text=input.trim();let result=text;
  const key=exact.get(text);
  if(key)result=t(key,{},code);
  else if(depth<4&&/[A-Za-z\u3000-\u9fff\uac00-\ud7ff]/u.test(text)){
    let match;
    for(const pattern of patterns){
      match=pattern.regex.exec(text);if(!match)continue;
      const params={};for(let i=0;i<pattern.names.length;i++)params[pattern.names[i]]=translate(match[i+1],code,depth+1);
      result=t(pattern.key,params,code);break;
    }
    if(!match){
      // Compound labels are split only on explicit separators, never by replacing
      // arbitrary Chinese characters inside user names, email addresses or codes.
      for(const separator of [' · ',' / '])if(text.includes(separator)){const parts=text.split(separator);const translated=parts.map(part=>translate(part,code,depth+1));if(translated.some((part,i)=>part!==parts[i])){result=translated.join(separator);break;}}
      if(result===text&&/[↗↶↑↓]$/.test(text)){const suffix=text.slice(-1);const body=text.slice(0,-1).trimEnd(),converted=translate(body,code,depth+1);if(body!==converted)result=converted+' '+suffix;}
    }
  }
  result=leading+result+trailing;
  if(depth===0){if(cache.size>=1600)cache.clear();cache.set(cacheKey,result);}return result;
}
function ignored(element){
  if(!element||element.closest?.(IGNORE))return true;
  const option=element.closest?.('option');if(option&&/^(zh(?:[-_](?:hans|hant|tw|cn))?|en|ja|ko)$/i.test(option.value))return true;
  return false;
}
function translateText(node){
  if(ignored(node.parentElement))return;
  const current=node.data;if(!current.trim())return;
  let record=textRecords.get(node);
  if(!record){record={original:current,written:null};textRecords.set(node,record);}
  else if(current!==record.written&&current!==record.original)record.original=current;
  const next=translate(record.original);record.written=next;if(current!==next)node.data=next;
}
function translateAttributes(element){
  if(ignored(element))return;
  const explicitKey=element.getAttribute('data-i18n');
  if(explicitKey&&hasTranslation(explicitKey)&&element.childElementCount===0){const value=t(explicitKey);if(element.textContent!==value)element.textContent=value;}
  let records=attributeRecords.get(element);if(!records){records=new Map();attributeRecords.set(element,records);}
  for(const name of ATTRIBUTES){
    if(name==='data-i18n')continue;
    if(!element.hasAttribute(name))continue;
    if(name==='content'&&!(element.tagName==='META'&&['description','og:title','og:description','twitter:title','twitter:description'].includes(element.getAttribute('name')||element.getAttribute('property'))))continue;
    const current=element.getAttribute(name);let record=records.get(name);
    if(!record){record={original:current,written:null};records.set(name,record);}else if(current!==record.written&&current!==record.original)record.original=current;
    const next=translate(record.original);record.written=next;if(current!==next)element.setAttribute(name,next);
  }
}
function scan(root){
  if(root.nodeType===3){translateText(root);return;}
  if(root.nodeType===1){if(ignored(root))return;translateAttributes(root);}
  const owner=root.ownerDocument||root;
  if(!owner.createTreeWalker)return;
  const walker=owner.createTreeWalker(root,5,{acceptNode(node){if(node.nodeType===1&&ignored(node))return 2;return 1;}});
  let node;while((node=walker.nextNode())){if(node.nodeType===3)translateText(node);else translateAttributes(node);}
}
function observe(){observer?.observe(observedRoot,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRIBUTES});}
function flush(){
  queued=false;if(!observedRoot)return;
  observer?.disconnect();
  try{const roots=[...pending];pending.clear();for(const node of roots){if(node===observedRoot||node.isConnected)scan(node);}}finally{observe();}
}
function enqueue(node){pending.add(node);if(!queued){queued=true;queueMicrotask(flush);}}
export function refreshTranslations(root=observedRoot){if(root)enqueue(root);}
export function initLocalization({root=globalThis.document,locale:initialLocale}={}){
  if(!root)return {locale:getLocale(),disconnect(){}};
  observer?.disconnect();observedRoot=root.nodeType===9?root.documentElement:root;
  if(globalThis.MutationObserver)observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='childList'){for(const node of record.addedNodes)if(node.nodeType===1||node.nodeType===3)enqueue(node);}
      else enqueue(record.target);
    }
  });
  setLocale(initialLocale??locale,{persist:initialLocale!==undefined});
  return {locale:getLocale(),disconnect(){observer?.disconnect();observer=null;observedRoot=null;pending.clear();}};
}
globalThis.addEventListener?.('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue)setLocale(event.newValue,{persist:false});});
