import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATALOG_ROWS,LOCALE_CODES} from '../../dist/games/spinrealm/locales/catalog.mjs';
import {dictionaries,t,translate,normalizeLocale,hasTranslation} from '../../dist/games/spinrealm/i18n.mjs';
import {THEMES,resolveAppearance,DEFAULT_APPEARANCE,validateImageMetadata,rasterDimensions,setImageScope,setEntitlements,getCustomImageState,restoreCustomImage,setCustomImage} from '../../dist/games/spinrealm/appearance.mjs';

const tokens=value=>[...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
test('all five languages have complete keys and identical interpolation tokens',()=>{
  assert.deepEqual(LOCALE_CODES,['zh-TW','zh-CN','en','ja','ko']);
  assert.equal(new Set(CATALOG_ROWS.map(row=>row[0])).size,CATALOG_ROWS.length);
  for(const row of CATALOG_ROWS){assert.equal(row.length,6,row[0]);for(const value of row.slice(1)){assert.equal(typeof value,'string',row[0]);assert.ok(value.trim(),row[0]);assert.deepEqual(tokens(value),tokens(row[1]),row[0]);}}
  for(const code of LOCALE_CODES)assert.equal(Object.keys(dictionaries[code]).length,CATALOG_ROWS.length);
});
test('source HTML and member/game literal keys are covered',()=>{
  const html=fs.readFileSync(new URL('../../dist/games/spinrealm/index.html',import.meta.url),'utf8').replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi,'');
  const texts=[...html.matchAll(/>([^<>]+)</g)].map(match=>match[1].trim()).concat([...html.matchAll(/(?:aria-label|title|alt|placeholder)=\"([^\"]*)\"/g)].map(match=>match[1]));
  for(const text of texts)assert.ok(!/[\u3400-\u9fff]/u.test(translate(text,'en')),text);
  for(const name of ['app.mjs','member-ui.mjs']){
    const source=fs.readFileSync(new URL('../../dist/games/spinrealm/'+name,import.meta.url),'utf8');
    const keys=[...source.matchAll(/['"]((?:common|settings|account|wallet|shop|appearance|subscription|friends|ranked|score|controller|errors)\.[A-Za-z_]+)['"]/g)].map(match=>match[1]);
    for(const key of keys)assert.ok(hasTranslation(key),key);
  }
});
test('dynamic engine messages retain numbers and interpolate in all languages',()=>{
  const messages=['護盾 3 行 · 2.3 秒','這一手：抵消 2 行 / 送出 6 行','音效已載入 8 / 10。對局開始後播放音樂，暫停時一起停下。','CPU 淨送出 4 行 · 待抵消 2 行 · 1.5 秒後抵達','暫存交換，目前存放 T 方塊。落子後解鎖。按鍵 C / SHIFT。每顆固定後才會解鎖。'];
  for(const language of ['en','ko'])for(const message of messages){const result=translate(message,language);assert.ok(!/[\u3400-\u9fff]/u.test(result),result);for(const number of message.match(/[0-9]+(?:\.[0-9]+)?/g)||[])assert.ok(result.includes(number));}
  assert.equal(t('score.summary',{score:123,best:456},'en'),'Score 123 · personal best 456');
  assert.equal(translate('보호막 3줄 · 2.3초','en'),'Shield 3 lines · 2.3 sec');
});
test('locale aliases and unknown source values are safe',()=>{
  assert.equal(normalizeLocale('zh-Hant'),'zh-TW');assert.equal(normalizeLocale('zh-Hans-CN'),'zh-CN');assert.equal(normalizeLocale('ja-JP'),'ja');assert.equal(normalizeLocale('ko-KR'),'ko');assert.equal(normalizeLocale('en_US'),'en');
  assert.equal(translate('my-name@example.test','ja'),'my-name@example.test');assert.equal(translate('562419','ko'),'562419');
});
test('appearance rejects prototype/invalid fields and keeps a readability floor',()=>{
  assert.deepEqual(resolveAppearance(null),DEFAULT_APPEARANCE);
  const value=resolveAppearance({theme:'__proto__',blocks:'constructor',board:'evil',background:'url(https://example.test)',customBackgroundEnabled:'true',boardOverlay:0});
  assert.equal(value.theme,'obsidian');assert.equal(value.blocks,'classic');assert.equal(value.board,'grid');assert.equal(value.background,'solid');assert.equal(value.customBackgroundEnabled,false);assert.equal(value.boardOverlay,.48);
  assert.equal(resolveAppearance({boardOverlay:5}).boardOverlay,.92);assert.equal(resolveAppearance({boardOverlay:NaN}).boardOverlay,.72);
});
test('all six palettes exceed WCAG AA normal-text contrast in their key tokens',()=>{
  const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  assert.equal(Object.keys(THEMES).length,6);
  for(const theme of Object.values(THEMES))for(const[a,b]of [[theme.text,theme.panel],[theme.muted,theme.panel],[theme.accent,theme.panel],[theme.onAccent,theme.accent]])assert.ok(contrast(a,b)>=4.5,theme.id);
});
test('raster validation rejects unsafe formats, oversized data and decompression bombs',()=>{
  for(const type of ['image/svg+xml','text/html','text/plain'])assert.throws(()=>validateImageMetadata({type,size:512,width:100,height:100}),{code:'image.type'});
  assert.throws(()=>validateImageMetadata({type:'image/png',size:5*1024*1024+1}),{code:'image.size'});
  assert.throws(()=>validateImageMetadata({type:'image/png',size:100,width:10000,height:10000}),{code:'image.dimensions'});
  assert.throws(()=>rasterDimensions(new TextEncoder().encode('<svg>not png</svg>'),'image/png'),{code:'image.decode'});
  const bytes=new Uint8Array(24),view=new DataView(bytes.buffer);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);view.setUint32(16,1920);view.setUint32(20,1080);assert.deepEqual(rasterDimensions(bytes,'image/png'),{width:1920,height:1080});
});
test('custom images need explicit server rights and are isolated on account switch',async()=>{
  setImageScope(null);setEntitlements({customImages:true});assert.equal(getCustomImageState().allowed,false);assert.equal(await restoreCustomImage(),false);
  await assert.rejects(setCustomImage(new Blob(['x'],{type:'image/png'})),{code:'errors.subscriptionRequired'});
  setImageScope('user-a');setEntitlements({customImages:true});assert.equal(getCustomImageState().allowed,true);
  setImageScope('user-b');assert.equal(getCustomImageState().allowed,false);assert.equal(getCustomImageState().available,false);assert.equal(await restoreCustomImage(),false);
  setImageScope(null);
});
