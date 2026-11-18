import './app.mjs';
import '/pwa.mjs';

// Platform integration is intentionally separate from deterministic game logic.
const style=document.createElement('style');
style.textContent=`.platform-nav{max-width:1460px;margin:auto;padding:10px 40px 0;display:flex;justify-content:space-between;align-items:center;color:#7897a6;font-size:9px;letter-spacing:1px;gap:20px}.platform-nav a{color:#a4bfcd;text-decoration:none}.platform-nav a:hover{color:#c3f96a}.platform-notice{position:fixed;left:50%;bottom:30px;z-index:100;max-width:calc(100vw - 32px);width:max-content;transform:translateX(-50%);font-size:12px;line-height:1.7;padding:12px 18px;border:1px solid #58725c;border-radius:8px;background:#20332b;color:#d7eccf;box-shadow:0 10px 30px #0006}.platform-notice[hidden]{display:none}@media(max-width:650px){.platform-nav{padding:9px 16px 0;font-size:8px}.platform-nav>span{font-size:7px}.in-session .platform-nav{display:none}}`;
document.head.append(style);
const bar=document.createElement('div');bar.className='platform-nav';
const back=document.createElement('a');back.href='/';back.textContent='← SNOWREALM GAMES';back.setAttribute('aria-label','回到 SnowRealmGames 遊戲館');
const badge=document.createElement('span');badge.textContent='WEB PLAYTEST / 鍵盤・觸控';bar.append(back,badge);document.body.prepend(bar);
const notice=document.createElement('div');notice.className='platform-notice';notice.hidden=true;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');document.body.append(notice);
let timer;window.addEventListener('srg:notice',event=>{if(!event.detail?.message)return;clearTimeout(timer);notice.textContent=event.detail.message;notice.hidden=false;timer=setTimeout(()=>{notice.hidden=true;},4500);});
try{localStorage.setItem('snowrealm.recent.v1',JSON.stringify({id:'spinrealm',at:Date.now()}));}catch{}
function openTarget(){if(location.hash==='#hold')document.getElementById('holdGuideBtn')?.click();if(location.hash==='#drill')document.getElementById('drillShortcut')?.click();}
window.addEventListener('hashchange',openTarget);openTarget();
