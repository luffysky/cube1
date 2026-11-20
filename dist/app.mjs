const FAVORITES_KEY='snowrealm.favorites.v1';
const RECENT_KEY='snowrealm.recent.v1';
const VALID_IDS=new Set(['spinrealm','brickduel','52hunt','next-floor','zero-dodge','refract-maze']);
const NAMES={spinrealm:'旋界',brickduel:'轉磚對戰','52hunt':'52 HUNT','next-floor':'NEXT FLOOR 下一層','zero-dodge':'零界閃避','refract-maze':'折光迷陣'};
const $=id=>document.getElementById(id);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
let favorites=new Set((Array.isArray(read(FAVORITES_KEY,[]))?read(FAVORITES_KEY,[]):[]).filter(id=>VALID_IDS.has(id)));
let currentFilter='all';let toastTimer;
export function notice(message){const el=$('siteToast');if(!el)return;clearTimeout(toastTimer);el.textContent=message;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
window.addEventListener('srg:notice',event=>notice(event.detail?.message||'設定已更新。'));
function updateFavorites(){
  document.querySelectorAll('[data-favorite]').forEach(button=>{const id=button.dataset.favorite;const active=favorites.has(id);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',`${active?'取消收藏':'收藏'}${NAMES[id]}`);if(button.classList.contains('favorite-toggle'))button.textContent=active?'★':'☆';else button.innerHTML=`${active?'★ 已收藏':'☆ 收藏這個世界'}`;});
  document.querySelectorAll('[data-game]').forEach(card=>card.classList.toggle('favorited',favorites.has(card.dataset.game)));
  if($('favoriteCount'))$('favoriteCount').textContent=favorites.size;
  if($('filterFavoriteCount'))$('filterFavoriteCount').textContent=String(favorites.size).padStart(2,'0');
}
function filterGames(){
  const cards=[...document.querySelectorAll('[data-game]')];if(!cards.length)return;
  const query=($('gameSearch')?.value||'').trim().toLocaleLowerCase();let visible=0,playable=0;
  cards.forEach(card=>{const matches=currentFilter==='all'||currentFilter===card.dataset.status||(currentFilter==='favorites'&&favorites.has(card.dataset.game));const found=!query||card.dataset.search.toLocaleLowerCase().includes(query);card.hidden=!(matches&&found);if(!card.hidden){visible++;if(card.dataset.status==='playable')playable++;}});
  $('resultCount').textContent=`${visible} 個世界 · ${playable} 個可試玩`;
  $('emptyState').hidden=visible>0;
  if(!visible){$('emptyTitle').textContent=currentFilter==='favorites'&&!query?'你的世界清單，還是空的。':'還沒找到這個世界。';$('emptyText').textContent=currentFilter==='favorites'&&!query?'點遊戲封面右上角的星星，把喜歡的世界留在這裡。':'換個關鍵字，或看看全部遊戲。';}
  document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===currentFilter)));
}
document.querySelectorAll('[data-favorite]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.favorite;if(!VALID_IDS.has(id))return;const next=new Set(favorites);next.has(id)?next.delete(id):next.add(id);
  try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...next]));favorites=next;updateFavorites();filterGames();notice(favorites.has(id)?`${NAMES[id]} 已加入這台裝置的收藏。`:`已取消收藏 ${NAMES[id]}。`);}catch{notice('瀏覽器目前無法儲存收藏。請檢查網站儲存空間或瀏覽模式。');}
}));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{currentFilter=button.dataset.filter;filterGames();}));
$('gameSearch')?.addEventListener('input',filterGames);
$('clearFilters')?.addEventListener('click',()=>{currentFilter='all';$('gameSearch').value='';filterGames();});
$('showFavorites')?.addEventListener('click',()=>{if(!$('games')){location.href='/?filter=favorites#games';return;}currentFilter='favorites';$('gameSearch').value='';filterGames();$('games').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
document.querySelectorAll('[data-play]').forEach(link=>link.addEventListener('click',()=>{try{localStorage.setItem(RECENT_KEY,JSON.stringify({id:'spinrealm',at:Date.now()}));}catch{}}));
function updateRecent(){const recent=read(RECENT_KEY,null);if($('continueSection'))$('continueSection').hidden=!(recent?.id==='spinrealm'&&Number.isFinite(recent.at));}
document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>$((button.dataset.open)).showModal()));
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$((button.dataset.close)).close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
$('clearLocalData')?.addEventListener('click',()=>{try{localStorage.removeItem(FAVORITES_KEY);localStorage.removeItem(RECENT_KEY);favorites.clear();updateFavorites();filterGames();updateRecent();notice('已清除此裝置的平台收藏與最近遊玩紀錄。');}catch{notice('瀏覽器無法清除資料，請從網站設定處理。');}});
$('backTop')?.addEventListener('click',event=>{event.preventDefault();scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
$('dismissUpdate')?.addEventListener('click',()=>{if($('updateBanner'))$('updateBanner').hidden=true;});
window.addEventListener('storage',event=>{if(event.key===FAVORITES_KEY){const raw=read(FAVORITES_KEY,[]);favorites=new Set((Array.isArray(raw)?raw:[]).filter(id=>VALID_IDS.has(id)));updateFavorites();filterGames();}if(event.key===RECENT_KEY)updateRecent();});
window.addEventListener('pageshow',updateRecent);
if(new URLSearchParams(location.search).get('filter')==='favorites')currentFilter='favorites';
updateFavorites();filterGames();updateRecent();
