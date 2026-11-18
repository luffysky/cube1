/* Visual preferences only. Purchases and Plus membership are authorized by the server. */
export const THEMES = Object.freeze({
  obsidian: Object.freeze({ id:'obsidian', nameKey:'theme.obsidian', scheme:'dark', bg:'#0b1115', panel:'#131e23', panelAlt:'#1b2b2d', line:'#3a5056', muted:'#a8b8ba', text:'#eff6f4', accent:'#c5f76b', onAccent:'#17220c', purple:'#c5aeff', red:'#ffaaa4', cyan:'#8bebe0', board:'#081216', grid:'#23363c', ghost:'#e3efeb' }),
  snow: Object.freeze({ id:'snow', nameKey:'theme.snow', scheme:'light', bg:'#eef4fa', panel:'#ffffff', panelAlt:'#e3edf4', line:'#8ba3b5', muted:'#445a6b', text:'#182e40', accent:'#245a80', onAccent:'#ffffff', purple:'#63419c', red:'#a8323b', cyan:'#066d70', board:'#122b3c', grid:'#2a4757', ghost:'#effaff' }),
  aurora: Object.freeze({ id:'aurora', nameKey:'theme.aurora', scheme:'dark', bg:'#071b20', panel:'#102b31', panelAlt:'#163d42', line:'#39646a', muted:'#aac7c9', text:'#eefbf5', accent:'#83efc3', onAccent:'#082b22', purple:'#cfb2ff', red:'#ffb0a2', cyan:'#91eaff', board:'#07191f', grid:'#21454b', ghost:'#dbfff1' }),
  sakura: Object.freeze({ id:'sakura', nameKey:'theme.sakura', scheme:'light', bg:'#faf0f5', panel:'#fffafb', panelAlt:'#f0e1eb', line:'#b491a5', muted:'#6d4d61', text:'#372033', accent:'#943e70', onAccent:'#ffffff', purple:'#7551a5', red:'#a5324b', cyan:'#23676c', board:'#241827', grid:'#4c354e', ghost:'#ffe6f4' }),
  cyber: Object.freeze({ id:'cyber', nameKey:'theme.cyber', scheme:'dark', bg:'#131025', panel:'#201b36', panelAlt:'#2c2547', line:'#665782', muted:'#bfb2d3', text:'#f8f0ff', accent:'#ecb6ff', onAccent:'#35153e', purple:'#beadff', red:'#ffb0bd', cyan:'#8af5ee', board:'#100c20', grid:'#34294d', ghost:'#f9dfff' }),
  ocean: Object.freeze({ id:'ocean', nameKey:'theme.ocean', scheme:'dark', bg:'#07182a', panel:'#10283d', panelAlt:'#17364e', line:'#3d6077', muted:'#aac2d5', text:'#eff8ff', accent:'#80d9f5', onAccent:'#082d3a', purple:'#c5b7ff', red:'#ffb6a6', cyan:'#95ead4', board:'#071725', grid:'#1f3d53', ghost:'#ddf6ff' }),
});
export const BLOCK_STYLES = Object.freeze(['classic','bevel','neon','glass','flat']);
export const BOARD_STYLES = Object.freeze(['grid','plain','stars']);
export const BOARD_PALETTES = Object.freeze({grid:Object.freeze({bg:'#081216',grid:'#253a43'}),plain:Object.freeze({bg:'#102a38',grid:'#294b5c'}),stars:Object.freeze({bg:'#19132a',grid:'#3d3157'})});
export const BACKGROUNDS = Object.freeze(['solid','aurora','dusk','snowfield','ocean']);
export const DEFAULT_APPEARANCE = Object.freeze({theme:'obsidian',blocks:'classic',board:'grid',background:'solid',boardOverlay:0.72,customBackgroundEnabled:false,customTarget:'background'});
const STORAGE_KEY='spinrealm.appearance.v2';
const MAX_IMAGE_BYTES=5*1024*1024, MAX_IMAGE_PIXELS=40_000_000, MAX_IMAGE_EDGE=12_000, OUTPUT_EDGE=2048;
const MIME_TYPES=new Set(['image/png','image/jpeg','image/webp']);
const listeners=new Set();
let entitlement=false, preview=false, imageBitmap=null, imageURL=null, currentImage=null, restoreVersion=0, imageScope=null;
let appearance=resolveAppearance(readPreference());
const preparedImages=new WeakSet();

function readPreference(){try{return JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY)||'null');}catch{return null;}}
function has(object,key){return Object.prototype.hasOwnProperty.call(object,key);}
export function resolveAppearance(raw){
  const value=raw&&typeof raw==='object'?raw:{};
  return {
    theme:has(THEMES,value.theme)?value.theme:DEFAULT_APPEARANCE.theme,
    blocks:BLOCK_STYLES.includes(value.blocks)?value.blocks:DEFAULT_APPEARANCE.blocks,
    board:BOARD_STYLES.includes(value.board)?value.board:DEFAULT_APPEARANCE.board,
    background:BACKGROUNDS.includes(value.background)?value.background:DEFAULT_APPEARANCE.background,
    boardOverlay:typeof value.boardOverlay==='number'&&Number.isFinite(value.boardOverlay)?Math.max(.48,Math.min(.92,value.boardOverlay)):DEFAULT_APPEARANCE.boardOverlay,
    customBackgroundEnabled:value.customBackgroundEnabled===true,
    customTarget:value.customTarget==='board'?'board':'background',
  };
}
export function getAppearance(){return {...appearance};}
export function getPalette(){return THEMES[appearance.theme];}
export function subscribeAppearance(listener){if(typeof listener!=='function')throw new TypeError('Listener required');listeners.add(listener);return()=>listeners.delete(listener);}
function notify(){for(const listener of listeners)listener(getAppearance(),{customImages:entitlement,preview,hasImage:!!currentImage});globalThis.dispatchEvent?.(new CustomEvent('spinrealm:appearance',{detail:getAppearance()}));}
export function setAppearance(patch,{persist=true}={}){
  appearance=resolveAppearance({...appearance,...patch});
  if(persist)try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify(appearance));}catch{}
  applyAppearance();notify();return getAppearance();
}
export function applyAppearance(root=globalThis.document?.documentElement){
  if(!root)return getAppearance();
  const palette=getPalette();
  const boardPalette=BOARD_PALETTES[appearance.board];
  const tokens={bg:palette.bg,panel:palette.panel,'panel-alt':palette.panelAlt,line:palette.line,muted:palette.muted,text:palette.text,lime:palette.accent,purple:palette.purple,red:palette.red,cyan:palette.cyan,'on-accent':palette.onAccent,'board-bg':boardPalette.bg,'board-grid':boardPalette.grid};
  for(const[name,value]of Object.entries(tokens))root.style.setProperty('--'+name,value);
  root.style.colorScheme=palette.scheme;root.dataset.theme=appearance.theme;root.dataset.background=appearance.background;root.dataset.blocks=appearance.blocks;
  root.dataset.customPreview=String(preview&&!!currentImage);
  const enabled=!!imageURL&&((entitlement&&imageScope&&appearance.customBackgroundEnabled)||preview)&&appearance.customTarget==='background';
  root.dataset.customBackground=String(enabled);
  if(enabled)root.style.setProperty('--custom-background-image',`url("${imageURL}")`);else root.style.removeProperty('--custom-background-image');
  root.style.setProperty('--custom-background-shade',palette.scheme==='light'?'.84':'.78');
  const meta=globalThis.document?.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',palette.bg);
  return getAppearance();
}
/** Call only with the result of the authenticated profile endpoint, never a stored browser flag. */
export function setImageScope(userId=null){
  const next=typeof userId==='string'&&userId.length>0&&userId.length<=200?userId:null;
  if(next!==imageScope){restoreVersion++;imageScope=next;preview=false;entitlement=false;releaseImage();applyAppearance();notify();}
  return imageScope;
}
export function setEntitlements({customImages=false}={}){
  const previous=entitlement;entitlement=customImages===true;
  if(previous!==entitlement){restoreVersion++;if(!entitlement&&!preview)releaseImage();applyAppearance();notify();}
  return {customImages:entitlement};
}
export function getCustomImageState(){return {allowed:entitlement&&!!imageScope,preview,available:!!currentImage,enabled:!!currentImage&&(preview||(entitlement&&!!imageScope&&appearance.customBackgroundEnabled)),target:appearance.customTarget,...(currentImage?{width:currentImage.width,height:currentImage.height,size:currentImage.size,mime:currentImage.mime}:{})};}

/** Canvas renderer preserves piece colors, so theme changes never change piece identity. */
function renderBlock(ctx,x,y,size,color,{ghost=false,active=false,style=appearance.blocks}={}){
  if(!BLOCK_STYLES.includes(style))style='classic';
  const gap=Math.max(1,size*.055),s=Math.max(1,size-gap*2),bx=x+gap,by=y+gap;
  ctx.save();
  if(ghost){ctx.globalAlpha*=.14;ctx.fillStyle=color;ctx.fillRect(bx,by,s,s);ctx.globalAlpha/= .14;ctx.strokeStyle=color;ctx.lineWidth=Math.max(1.5,size*.055);ctx.strokeRect(bx+.5,by+.5,s-1,s-1);ctx.restore();return;}
  ctx.fillStyle=color;ctx.fillRect(bx,by,s,s);
  if(style==='classic'||style==='bevel'){
    const inset=Math.max(1,size*(style==='bevel'?.16:.1));
    ctx.fillStyle=style==='bevel'?'#ffffff65':'#ffffff35';ctx.fillRect(bx,by,s,inset);
    ctx.fillStyle='#00000038';ctx.fillRect(bx,by+s-inset,s,inset);
    ctx.fillStyle='#ffffff25';ctx.fillRect(bx,by,inset,s);
    if(style==='bevel'){ctx.fillStyle='#00000025';ctx.fillRect(bx+s-inset,by,inset,s);}
  }else if(style==='neon'){
    ctx.fillStyle='#07101ec4';ctx.fillRect(bx+2,by+2,Math.max(0,s-4),Math.max(0,s-4));
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(1.5,size*.065);ctx.strokeRect(bx+1,by+1,Math.max(0,s-2),Math.max(0,s-2));
    ctx.fillStyle='#ffffffb0';ctx.fillRect(bx+2,by+2,Math.max(0,s-4),Math.max(1,size*.045));
  }else if(style==='glass'){
    const gradient=ctx.createLinearGradient(bx,by,bx+s,by+s);gradient.addColorStop(0,'#ffffff65');gradient.addColorStop(.48,'#ffffff15');gradient.addColorStop(.52,'#00000005');gradient.addColorStop(1,'#00000030');
    ctx.fillStyle=gradient;ctx.fillRect(bx,by,s,s);ctx.strokeStyle='#ffffff65';ctx.lineWidth=Math.max(1,size*.03);ctx.strokeRect(bx+.5,by+.5,s-1,s-1);
  }else{ctx.strokeStyle='#0000004d';ctx.lineWidth=Math.max(1,size*.04);ctx.strokeRect(bx+.5,by+.5,s-1,s-1);}
  if(active){ctx.strokeStyle='#ffffffb3';ctx.lineWidth=Math.max(1,size*.035);ctx.strokeRect(bx+.5,by+.5,s-1,s-1);}
  ctx.restore();
}
const blockCache=new WeakMap();
/** Cache static raster tiles so glass gradients and beveled faces are not rebuilt each frame. */
export function drawBlock(ctx,x,y,size,color,options={}){
  if(!globalThis.OffscreenCanvas&&!globalThis.document)return renderBlock(ctx,x,y,size,color,options);
  let cache=blockCache.get(ctx);if(!cache){cache=new Map();blockCache.set(ctx,cache);}
  const style=options.style||appearance.blocks,key=[size.toFixed(3),color,style,!!options.ghost,!!options.active].join(':');let tile=cache.get(key);
  if(!tile){
    const edge=Math.max(1,Math.ceil(size));tile=globalThis.OffscreenCanvas?new OffscreenCanvas(edge,edge):document.createElement('canvas');tile.width=edge;tile.height=edge;
    const context=tile.getContext('2d');if(!context)return renderBlock(ctx,x,y,size,color,options);
    renderBlock(context,0,0,size,color,{...options,style});if(cache.size>=128)cache.clear();cache.set(key,tile);
  }
  ctx.drawImage(tile,x,y);
}
function drawCover(ctx,image,w,h){const iw=image.width||image.naturalWidth,ih=image.height||image.naturalHeight;const scale=Math.max(w/iw,h/ih);ctx.drawImage(image,(w-iw*scale)/2,(h-ih*scale)/2,iw*scale,ih*scale);}
export function drawBoardBackground(ctx,w,h,{columns=10,rows=20,showGrid=true,custom=true}={}){
  const palette=getPalette(),boardPalette=BOARD_PALETTES[appearance.board];ctx.save();ctx.fillStyle=boardPalette.bg;ctx.fillRect(0,0,w,h);
  if(custom&&imageBitmap&&appearance.customTarget==='board'&&(preview||(entitlement&&imageScope&&appearance.customBackgroundEnabled))){drawCover(ctx,imageBitmap,w,h);ctx.globalAlpha=appearance.boardOverlay;ctx.fillStyle=boardPalette.bg;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;}
  if(appearance.board==='stars'){
    ctx.fillStyle=palette.ghost;ctx.globalAlpha=.13;
    for(let i=0;i<38;i++){const x=((i*73+29)%997)/997*w,y=((i*193+71)%991)/991*h,r=(i%4===0?1.5:1)*Math.max(1,w/340);ctx.fillRect(x,y,r,r);}
    ctx.globalAlpha=1;
  }
  if(showGrid&&appearance.board!=='plain'){
    ctx.strokeStyle=boardPalette.grid;ctx.lineWidth=Math.max(1,w/700);ctx.beginPath();
    for(let x=1;x<columns;x++){const p=Math.round(x*w/columns)+.5;ctx.moveTo(p,0);ctx.lineTo(p,h);}
    for(let y=1;y<rows;y++){const p=Math.round(y*h/rows)+.5;ctx.moveTo(0,p);ctx.lineTo(w,p);}ctx.stroke();
  }
  ctx.restore();
}

function imageError(code){const error=new Error(code);error.code=code;return error;}
export function validateImageMetadata({type,size,width,height}){
  if(!MIME_TYPES.has(type))throw imageError('image.type');
  if(!Number.isSafeInteger(size)||size<1||size>MAX_IMAGE_BYTES)throw imageError('image.size');
  if(width!==undefined||height!==undefined){if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<64||height<64||width>MAX_IMAGE_EDGE||height>MAX_IMAGE_EDGE||width*height>MAX_IMAGE_PIXELS)throw imageError('image.dimensions');}
  return true;
}
function ascii(bytes,start,end){return String.fromCharCode(...bytes.subarray(start,end));}
/** Read raster headers before decoding to reject mismatched MIME types and decompression bombs. */
export function rasterDimensions(buffer,type){
  const b=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
  if(type==='image/png'){
    if(b.length<24||b[0]!==137||ascii(b,1,4)!=='PNG'||b[4]!==13||b[5]!==10||b[6]!==26||b[7]!==10||ascii(b,12,16)!=='IHDR')throw imageError('image.decode');
    return {width:v.getUint32(16),height:v.getUint32(20)};
  }
  if(type==='image/jpeg'){
    if(b.length<4||b[0]!==255||b[1]!==216)throw imageError('image.decode');let i=2;
    while(i+4<b.length){if(b[i++]!==255)throw imageError('image.decode');while(b[i]===255)i++;const marker=b[i++];if(marker===0xd9||marker===0xda)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;const length=v.getUint16(i);if(length<2||i+length>b.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){if(length<8)break;return {width:v.getUint16(i+5),height:v.getUint16(i+3)};}i+=length;}
    throw imageError('image.decode');
  }
  if(type==='image/webp'){
    if(b.length<30||ascii(b,0,4)!=='RIFF'||ascii(b,8,12)!=='WEBP')throw imageError('image.decode');const format=ascii(b,12,16);
    if(format==='VP8X')return {width:1+b[24]+(b[25]<<8)+(b[26]<<16),height:1+b[27]+(b[28]<<8)+(b[29]<<16)};
    if(format==='VP8 '&&b[23]===0x9d&&b[24]===1&&b[25]===0x2a)return {width:v.getUint16(26,true)&0x3fff,height:v.getUint16(28,true)&0x3fff};
    if(format==='VP8L'&&b[20]===0x2f){const bits=v.getUint32(21,true);return {width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1};}
  }
  throw imageError('image.decode');
}
async function inputBlob(input){
  if(typeof Blob!=='undefined'&&input instanceof Blob)return input;
  if(typeof input==='string'){
    const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(input);
    if(!match)throw imageError('image.type');if(match[2].length>Math.ceil(MAX_IMAGE_BYTES*4/3)+4)throw imageError('image.size');
    try{const data=atob(match[2]),bytes=Uint8Array.from(data,c=>c.charCodeAt(0));return new Blob([bytes],{type:match[1]});}catch{throw imageError('image.decode');}
  }
  throw imageError('image.type');
}
async function decodeBlob(blob){
  if(globalThis.createImageBitmap)return createImageBitmap(blob);
  if(!globalThis.Image)throw imageError('image.unsupported');
  const url=URL.createObjectURL(blob);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(imageError('image.decode'));img.src=url;});}finally{URL.revokeObjectURL(url);}
}
export async function prepareCustomImage(input){
  const blob=await inputBlob(input);validateImageMetadata({type:blob.type,size:blob.size});
  const dimensions=rasterDimensions(await blob.arrayBuffer(),blob.type);validateImageMetadata({type:blob.type,size:blob.size,...dimensions});
  let decoded;try{decoded=await decodeBlob(blob);}catch(error){throw imageError(error.code||'image.decode');}
  try{
    const width=decoded.width||decoded.naturalWidth,height=decoded.height||decoded.naturalHeight;validateImageMetadata({type:blob.type,size:blob.size,width,height});
    const scale=Math.min(1,OUTPUT_EDGE/Math.max(width,height));const targetWidth=Math.max(1,Math.round(width*scale)),targetHeight=Math.max(1,Math.round(height*scale));
    const canvas=globalThis.OffscreenCanvas?new OffscreenCanvas(targetWidth,targetHeight):globalThis.document?.createElement('canvas');if(!canvas)throw imageError('image.unsupported');
    canvas.width=targetWidth;canvas.height=targetHeight;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw imageError('image.unsupported');ctx.fillStyle='#101a21';ctx.fillRect(0,0,targetWidth,targetHeight);ctx.drawImage(decoded,0,0,targetWidth,targetHeight);
    const encoded=canvas.convertToBlob?await canvas.convertToBlob({type:'image/webp',quality:.9}):await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9));
    if(!encoded)throw imageError('image.decode');validateImageMetadata({type:encoded.type,size:encoded.size,width:targetWidth,height:targetHeight});
    const result=Object.freeze({blob:encoded,width:targetWidth,height:targetHeight,mime:encoded.type,size:encoded.size});preparedImages.add(result);return result;
  }finally{decoded.close?.();}
}
function releaseImage(){imageBitmap?.close?.();imageBitmap=null;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=null;currentImage=null;}
async function idb(mode,callback){
  if(!globalThis.indexedDB)throw imageError('image.storage');
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('spinrealm-private-appearance',1);request.onupgradeneeded=()=>request.result.createObjectStore('images');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(imageError('image.storage'));});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('images',mode);const request=callback(tx.objectStore('images'));let value;request.onsuccess=()=>{value=request.result;};request.onerror=()=>reject(imageError('image.storage'));tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(imageError('image.storage'));tx.onabort=()=>reject(imageError('image.storage'));});}finally{db.close();}
}
export async function setCustomImage(input,{target='background',preview:localPreview=false,persist=true}={}){
  if((!entitlement||!imageScope)&&!localPreview)throw imageError('errors.subscriptionRequired');
  const request=++restoreVersion,scope=imageScope;
  const prepared=preparedImages.has(input)?input:await prepareCustomImage(input);
  const decoded=await decodeBlob(prepared.blob);
  if(request!==restoreVersion||((!entitlement||!imageScope)&&!localPreview)){decoded.close?.();throw imageError('errors.subscriptionRequired');}
  if(persist&&!localPreview)await idb('readwrite',store=>store.put({blob:prepared.blob,width:prepared.width,height:prepared.height,mime:prepared.mime,size:prepared.size},'custom:'+scope));
  if(request!==restoreVersion||scope!==imageScope||((!entitlement||!imageScope)&&!localPreview)){decoded.close?.();throw imageError('errors.subscriptionRequired');}
  releaseImage();imageBitmap=decoded;imageURL=URL.createObjectURL(prepared.blob);currentImage=prepared;preview=localPreview===true;
  setAppearance({customTarget:target==='board'?'board':'background',customBackgroundEnabled:!preview},{persist:!preview});
  return {width:prepared.width,height:prepared.height,mime:prepared.mime,size:prepared.size,preview,localOnly:true};
}
export async function restoreCustomImage(){
  if(!entitlement||!imageScope||!appearance.customBackgroundEnabled)return false;
  const version=restoreVersion,key='custom:'+imageScope,stored=await idb('readonly',store=>store.get(key));
  if(!stored?.blob||version!==restoreVersion||!entitlement)return false;
  await setCustomImage(stored.blob,{target:appearance.customTarget,persist:false});return true;
}
export function clearCustomPreview(){if(!preview)return;preview=false;releaseImage();appearance=resolveAppearance(readPreference());applyAppearance();notify();if(entitlement&&appearance.customBackgroundEnabled)void restoreCustomImage().catch(()=>{});}
export async function clearCustomImage(){const key=imageScope?'custom:'+imageScope:null;restoreVersion++;preview=false;releaseImage();setAppearance({customBackgroundEnabled:false});if(key)await idb('readwrite',store=>store.delete(key));}

