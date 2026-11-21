// SnowRealm Games management console. No tokens are stored, logged or displayed.
// Backend enforces a verified signed JWT + server-side explicit subject allowlist.
import { CONFIG } from '../../dist/games/spinrealm/config.mjs';
import { createAuthClient } from '../../dist/games/spinrealm/vendor/neon-auth.mjs';

import { gameCatalog } from './game-catalog.mjs';
import { panelRoutes, playerPage } from './routes.mjs';

const mount=new URL('.',document.baseURI);
function panelFromLocation(){
 const route=location.pathname.slice(mount.pathname.length);
 if(playerPage.test(route))return 'player';
 return Object.keys(panelRoutes).find(panel=>panelRoutes[panel]===route)??'overview';
}

const auth=createAuthClient(CONFIG.authUrl),$=id=>document.getElementById(id);
const panels=['overview','trends','players','player','ledger','games','matches','operations','audit','integrations','compliance'];
const titles={overview:'營運總覽',trends:'營運趨勢',players:'玩家管理',player:'玩家詳情',ledger:'金幣帳本',games:'遊戲管理',matches:'排位對局',operations:'營運操作',audit:'操作稽核',integrations:'跨遊戲整合',compliance:'隱私與法規'};
let subject=null,token=null,expiry=0,authorized=false,active='overview',busy=false,ownerRetry=null,operationsEnabled=false;
const fmt=n=>Number(n||0).toLocaleString('zh-TW');
const date=value=>{if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('zh-TW');};
function status(value,type=''){
 $('apiStatus').textContent=value;$('apiStatus').className='status '+type;
}
function message(value){$('authMessage').textContent=value;}
function showPanel(name,{navigate=true}={}){
 if(!panels.includes(name)||(name==='operations'&&!operationsEnabled))return;
 if(navigate&&panelRoutes[name]){
  const url=new URL(panelRoutes[name],mount);
  if(url.pathname!==location.pathname)history.pushState(null,'',url);
 }
 active=name;$('sectionTitle').textContent=titles[name];
 $('refresh').disabled=!authorized||busy||!dataPanels.includes(name);
 for(const panel of panels){
  $(panel+'Panel').hidden=panel!==name;
  document.querySelector('[data-panel="'+panel+'"]')?.setAttribute('aria-current',panel===name?'page':'false');
 }
 if(authorized&&name==='games')renderGameCatalog();
 if(authorized&&['overview','trends','players','player','ledger','matches','audit'].includes(name))void fetchPanel(name);
}
function toRows(body,rows){
 body.replaceChildren();
 if(!rows?.length){
  const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=10;td.className='empty';td.textContent='尚無資料';tr.append(td);body.append(tr);return;
 }
 for(const record of rows){
  const tr=document.createElement('tr');
  for(const raw of record){const td=document.createElement('td');if(raw instanceof Node)td.append(raw);else td.textContent=String(raw??'—');tr.append(td);}
  body.append(tr);
 }
}
const dataPanels=['overview','trends','players','player','ledger','matches','audit'];
const tableRows={players:[],ledger:[],matches:[]};
function operationButton(label,operation,target){
 const button=document.createElement('button');
 button.type='button';
 button.textContent=label;
 button.addEventListener('click',()=>{
  if(!authorized||!operationsEnabled)return;
  showPanel('operations');
  const select=$('ownerAction');
  select.value=operation;
  select.dispatchEvent(new Event('change'));
  $('ownerForm').elements.targetId.value=target;
  $('ownerResult').textContent='';
  $('operationHeading').tabIndex=-1;
  $('operationHeading').focus();
 });
 return button;
}
function renderTable(which){
 const query=$(which+'Filter').value.trim().toLowerCase();
 const records=tableRows[which];
 const filtered=records.filter(row=>row.some(value=>String(value??'').toLowerCase().includes(query)));
 $(which+'Count').textContent=filtered.length+' / '+records.length+' 筆已載入資料';
 const actions=which!=='ledger'&&operationsEnabled;
 if(which!=='ledger')$(which+'Operations').hidden=!actions;
 toRows($(which+'Body'),filtered.map(row=>{
  if(which==='players'&&playerPage.test('players/'+row[0])){
   const link=document.createElement('a');
   link.href=new URL('players/'+row[0],mount);
   link.textContent=row[1]??row[0];
   link.addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    history.pushState(null,'',link.href);
    showPanel('player',{navigate:false});
   });
   row=[row[0],link,...row.slice(2)];
  }
  if(!actions)return row;
  const group=document.createElement('div');
  group.className='row-actions';
  if(which==='players'){
   group.append(operationButton('停權','suspend',row[0]),operationButton('解封','restore',row[0]),operationButton('金幣加扣','coins',row[0]));
  }else group.append(operationButton('對局更正','match-correction',row[0]));
  return [...row,group];
 }));
}
for(const which of Object.keys(tableRows))$(which+'Filter').addEventListener('input',()=>renderTable(which));
function renderTrends(info){
 const records=Array.isArray(info?.items)?info.items:[];
 if(info?.scope!=='cube1'||info?.timezone!=='UTC'||info?.days!==7||records.length!==7)throw Error('invalid_trends');
 const totals=records.reduce((o,r)=>({
  players:o.players+Number(r.newPlayers||0),matches:o.matches+Number(r.rankedMatches||0),
  earned:o.earned+BigInt(r.coinsEarned||'0'),spent:o.spent+BigInt(r.coinsSpent||'0')
 }),{players:0,matches:0,earned:0n,spent:0n});
 $('trendsPlayers').textContent=fmt(totals.players);
 $('trendsMatches').textContent=fmt(totals.matches);
 $('trendsEarned').textContent=totals.earned.toLocaleString('zh-TW');
 $('trendsSpent').textContent=totals.spent.toLocaleString('zh-TW');
 const max=Math.max(1,...records.flatMap(r=>[Number(r.newPlayers||0),Number(r.rankedMatches||0)]));
 const chart=$('trendChart');chart.replaceChildren();
 const compact=new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric',timeZone:'UTC'});
 for(const r of records){
  const cell=document.createElement('div');cell.className='trend-day';
  const bars=document.createElement('div');bars.className='trend-bars';
  for(const [kind,value] of [['new',Number(r.newPlayers||0)],['matches',Number(r.rankedMatches||0)]]){
   const bar=document.createElement('div');bar.className='trend-bar '+kind;
   bar.style.height=(value/max*100)+'%';bar.title=(kind==='new'?'新增玩家':'排位對局')+'：'+value;
   bars.append(bar);
  }
  const label=document.createElement('small');
  label.textContent=compact.format(new Date(r.day+'T00:00:00Z'));
  cell.append(bars,label);chart.append(cell);
 }
 chart.setAttribute('aria-label',records.map(r=>r.day+'：新增玩家 '+r.newPlayers+'、排位對局 '+r.rankedMatches).join('；'));
 toRows($('trendsBody'),records.map(r=>[r.day,fmt(r.newPlayers),fmt(r.rankedMatches),BigInt(r.coinsEarned||'0').toLocaleString('zh-TW'),BigInt(r.coinsSpent||'0').toLocaleString('zh-TW')]));
}
function decodeJWT(jwt){
 if(typeof jwt!=='string'||jwt.split('.').length!==3)return null;
 try{
  const part=jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(atob(part));
 }catch{return null;}
}
async function signedToken(force=false){
 if(!subject)throw Error('not_signed_in');
 if(!force&&token&&expiry-Date.now()>30000)return token;
 let reply=await auth.getSession();
 if(reply.error||reply.data?.user?.id!==subject)throw Error('session_expired');
 let candidate=reply.data?.session?.token,claims=decodeJWT(candidate);
 if(!claims||claims.sub!==subject||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()){
  // The Better Auth session cookie is not the game API JWT. Obtain a signed
  // token with browser-managed credentials, but never persist it.
  const url=CONFIG.authUrl.replace(/\/$/,'')+'/token';
  const response=await fetch(url,{credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('jwt_unavailable');
  candidate=(await response.json()).token;claims=decodeJWT(candidate);
 }
 if(!claims||claims.sub!==subject||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now())throw Error('jwt_unavailable');
 token=candidate;expiry=claims.exp*1000;return token;
}
async function api(path,refresh=false){
 const bearer=await signedToken(refresh);
 const response=await fetch(new URL(path.slice(1),mount),{method:'GET',mode:'same-origin',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',Authorization:'Bearer '+bearer}});
 const payload=await response.json().catch(()=>null);
 if(response.status===401&&!refresh){token=null;return api(path,true);}
 if(!response.ok){const err=new Error(payload?.error?.code||'HTTP_'+response.status);err.status=response.status;throw err;}
 return payload;
}
function renderPlayer({profile,ledger,matches}){
 const fields=$('playerFields');
 fields.replaceChildren();
 $('playerName').textContent=profile.nickname;
 for(const [key,value] of [
  ['玩家 ID',profile.playerId],['好友代碼',profile.friendCode],['建立時間',date(profile.createdAt)],
  ['平台玩家 ID',profile.platformPlayerId??'尚未取得平台 ID'],['金幣',profile.coins==null?'尚無錢包':BigInt(profile.coins).toLocaleString('zh-TW')],
  ['排位分數',profile.rating],['排位場次',profile.games],['訂閱方案',profile.plan??'尚無方案'],
  ['訂閱狀態',profile.planStatus],['訂閱到期',date(profile.planExpiresAt)]
 ]){
  const label=document.createElement('dt'),data=document.createElement('dd');
  label.textContent=key;data.textContent=value??'—';fields.append(label,data);
 }
 toRows($('playerLedger'),ledger.map(row=>[date(row.createdAt),row.delta,row.reason]));
 toRows($('playerMatches'),matches.map(row=>[date(row.createdAt),row.id,row.status]));
 const actions=$('playerActions');actions.replaceChildren();
 if(operationsEnabled)actions.append(operationButton('停權','suspend',profile.playerId),
  operationButton('解封','restore',profile.playerId),operationButton('金幣加扣','coins',profile.playerId));
 $('playerStatus').textContent='資料來源：旋界（cube1）';
 $('playerData').hidden=false;
}
async function fetchPanel(which=active){
 if(busy||!authorized||!['overview','trends','players','player','ledger','matches','audit'].includes(which))return;
 busy=true;$('refresh').disabled=true;status('更新中');
 const playerRoute=which==='player'?location.pathname.slice(mount.pathname.length):null;
 try{
  if(playerRoute){
   $('playerData').hidden=true;
   $('playerStatus').textContent='正在載入玩家資料…';
  }
  if(which==='audit'){
   $('ownerAuditLog').hidden=true;
   $('auditStatus').textContent=operationsEnabled?'正在載入操作紀錄…':'操作稽核尚未啟用。';
   if(!operationsEnabled){status('管理權限已驗證','ready');return;}
  }
  const info=await api('/v1/admin/'+(playerRoute??(which==='audit'?'owner/audit':which)));
  if(which==='audit'){
   auditRows=info.items;
   renderAudit();
   $('ownerAuditLog').hidden=false;
  }
  if(playerRoute&&playerRoute!==location.pathname.slice(mount.pathname.length))return;
  if(playerRoute)renderPlayer(info);
  if(which==='overview'){
   for(const key of ['players','wallets','outstandingCoins','rankedMatches','runningMatches','queuedPlayers'])document.querySelector('[data-metric="'+key+'"]').textContent=fmt(info[key]);
  }else if(which==='trends'){
   renderTrends(info);
  }else if(which==='players'){
   tableRows.players=(info.items??[]).map(x=>[x.playerId,x.nickname,x.friendCode,fmt(x.coins),fmt(x.rating),fmt(x.games),date(x.createdAt)]);
   renderTable(which);
  }else if(which==='ledger'){
   tableRows.ledger=(info.items??[]).map(x=>[x.eventId,x.playerId,(Number(x.delta)>0?'+':'')+x.delta,fmt(x.balanceAfter),x.reason,date(x.createdAt)]);
   renderTable(which);
  }else if(which==='matches'){
   tableRows.matches=(info.items??[]).map(x=>[x.matchId,x.players?.join(' / '),x.status,date(x.startedAt),date(x.settledAt)]);
   renderTable(which);
  }
  status('管理權限已驗證','ready');message('管理身分已驗證。');
 }catch(error){
  if(which==='audit')$('auditStatus').textContent='無法載入操作紀錄。';
  if(playerRoute)$('playerStatus').textContent='無法載入玩家資料。';
  if(error.status===403){authorized=false;$('dashboard').hidden=true;status('沒有管理權限','error');message('目前帳號不在後端管理員白名單內。');}
  else if(playerRoute&&error.message==='player_not_found'){$('playerStatus').textContent='找不到此玩家。';status('管理權限已驗證','ready');}
  else if(error.status===404||error.status===503){status('API 尚未部署','error');message('管理介面已建立，但後端管理 API 尚未啟用或部署。');}
  else if(error.status===401){authorized=false;$('dashboard').hidden=true;status('登入憑證失效','error');message('請重新在 SnowRealm Games 登入再試。');}
  else{status('讀取失敗','error');message('無法讀取管理資料。請檢查後端部署與網路，不要在聊天分享 JWT。');}
 }finally{busy=false;$('refresh').disabled=!authorized||!dataPanels.includes(active);
  if(authorized&&dataPanels.includes(active)&&(active!==which||(playerRoute&&panelFromLocation()==='player'&&playerRoute!==location.pathname.slice(mount.pathname.length))))void fetchPanel(active);
 }
}
async function verify(){
 if(busy)return;
 busy=true;$('checkAuth').disabled=true;message('正在驗證身分…');status('驗證中');
 try{
  const result=await auth.getSession();
  if(result.error||!result.data?.user?.id){authorized=false;subject=null;$('dashboard').hidden=true;status('請先登入','error');message('請先在 SnowRealm Games 遊戲館完成登入，再回來按「驗證登入身分」。');return;}
  if(subject!==result.data.user.id){token=null;expiry=0;}
  subject=result.data.user.id;
  // Do not show or store subject or email; server must grant access.
  await signedToken(true);
  // The query below is the definitive authorization check.
  const response=await api('/v1/admin/overview');
  authorized=true;
  if(active==='games')renderGameCatalog();
  $('dashboard').hidden=false;$('refresh').disabled=false;
  operationsEnabled=Boolean(response.operationsEnabled);
  $('operationsNav').hidden=!operationsEnabled;
  if(active==='operations'&&!operationsEnabled)showPanel('overview');
  $('ownerNote').hidden=!response.owner;
  $('ownerForm').elements.note.disabled=!response.owner;
  $('ownerAuditNote').hidden=!response.owner;
  $('ownerAuditLog').hidden=true;
  auditRows=[];
  $('ownerAuditBody').replaceChildren();
  if(!response.owner)$('ownerForm').elements.note.value='';
  if(response.operationsEnabled)void fillOperationTargets();
  for(const key of ['players','wallets','outstandingCoins','rankedMatches','runningMatches','queuedPlayers'])document.querySelector('[data-metric="'+key+'"]').textContent=fmt(response[key]);
  status(response.owner?'Owner':'管理員','ready');message('管理身分已驗證。');
 }catch(error){
  authorized=false;$('dashboard').hidden=true;
  status('尚未授權','error');
  message(error.status===403?'你的帳號不在後端管理員白名單。':error.status===404||error.status===503?'後端管理 API 尚未部署或啟用。':'登入驗證或網路存取失敗。請確認遊戲館已登入。');
 }finally{busy=false;$('checkAuth').disabled=false;
  $('refresh').disabled=!authorized||!dataPanels.includes(active);
  if(authorized&&active!=='overview'&&dataPanels.includes(active))void fetchPanel(active);
 }
}
$('checkAuth').addEventListener('click',()=>void verify());
$('refresh').addEventListener('click',()=>void fetchPanel(active));
for(const button of document.querySelectorAll('[data-panel]'))button.addEventListener('click',()=>showPanel(button.dataset.panel));
showPanel(panelFromLocation(),{navigate:false});
window.addEventListener('popstate',()=>showPanel(panelFromLocation(),{navigate:false}));
window.addEventListener('focus',()=>{if(!document.hidden&&authorized&&expiry<Date.now()){authorized=false;token=null;$('dashboard').hidden=true;status('需重新驗證');}});
async function fillOperationTargets(){
 const isMatch=$('ownerAction').value==='match-correction';
 const options=$('ownerTargets');
 options.replaceChildren();
 try{
  const data=await api('/v1/admin/'+(isMatch?'matches':'players'));
  if(($('ownerAction').value==='match-correction')!==isMatch)return;
  for(const item of data.items??[]){
   const option=document.createElement('option');
   option.value=isMatch?item.matchId:item.playerId;
   option.label=isMatch?item.players.join(' / '):item.nickname;
   options.append(option);
  }
 }catch{ /* The ID may still be entered directly. */ }
}
$('ownerAction').addEventListener('change',()=>{
 const selected=$('ownerAction').value;
 for(const [id,name,show] of [['ownerCoins','delta',selected==='coins'],['ownerMatch','outcome',selected==='match-correction']]){
  $(id).hidden=!show;
  $('ownerForm').elements[name].disabled=!show;
 }
 $('ownerTargetLabel').textContent=selected==='match-correction'?'對局 ID':'玩家 ID';
 $('ownerForm').elements.targetId.value='';
 if(authorized)void fillOperationTargets();
});
$('ownerForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!authorized||!operationsEnabled)return;
 const form=event.currentTarget,button=form.querySelector('[type="submit"]');
 if(button.disabled)return;
 const values=new FormData(form);
 const selected=values.get('operation');
 const operation=['suspend','restore'].includes(selected)?'suspension':selected;
 const body={targetId:String(values.get('targetId')).trim(),reason:values.get('reason')};
 if(values.has('note'))body.note=values.get('note');
 if(operation==='suspension')body.suspended=selected==='suspend';
 if(operation==='coins'){
  body.delta=Number(values.get('delta'));
  if(!Number.isSafeInteger(body.delta)||body.delta===0){
   $('ownerResult').textContent='請輸入非零整數。';
   return;
  }
 }
 if(operation==='match-correction')body.outcome=values.get('outcome');
 if(!window.confirm('確認套用這項 Games 營運調整？'))return;
 const payload=JSON.stringify(body);
 if(ownerRetry?.payload!==payload||ownerRetry.operation!==operation)
  ownerRetry={payload,operation,key:crypto.randomUUID()};
 button.disabled=true;
 try{
  const bearer=await signedToken();
  const response=await fetch(new URL('v1/admin/owner/'+operation,mount),{
   method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+bearer,
    'Content-Type':'application/json','Idempotency-Key':ownerRetry.key},body:payload
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw Error(result?.error?.code??'HTTP '+response.status);
  ownerRetry=null;
  $('ownerResult').textContent='調整已儲存。';
  await fetchPanel();
 }catch(error){$('ownerResult').textContent='未確認儲存結果：'+error.message;}
 finally{button.disabled=false;}
});
let auditRows=[];
const auditOperations={'suspension':'停權／解封','coins':'金幣加扣','match-correction':'對局更正'};
const auditDay=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit'});
function renderAudit(){
 const query=$('auditFilter').value.trim().toLowerCase();
 const selectedDate=$('auditDate').value;
 const rows=auditRows.filter(row=>
  [row.actorId,row.targetId].some(id=>String(id??'').toLowerCase().includes(query))&&
  (!selectedDate||auditDay.format(new Date(row.createdAt))===selectedDate)
 );
 toRows($('ownerAuditBody'),rows.map(row=>[row.actorId,auditOperations[row.operation]??row.operation,row.targetId,row.reason,
  ...(!$('ownerAuditNote').hidden?[row.note]:[]),date(row.createdAt)]));
 $('auditStatus').textContent=rows.length+' / '+auditRows.length+' 筆已載入紀錄';
}
$('auditFilter').addEventListener('input',renderAudit);
$('auditDate').addEventListener('input',renderAudit);
$('ownerAudit').addEventListener('click',()=>showPanel('audit'));


function renderGameCatalog(){
 const source=$('gameSource').value;
 const status=$('gameStatus').value;
 const games=gameCatalog.filter(game=>(!source||game.source===source)&&(!status||game.status===status));
 const rows=games.map(game=>{
  const link=document.createElement('a');
  link.href=new URL(game.href,'https://games.snowrealm.pet');
  link.textContent=game.name;
  const management={spinrealm:'旋界管理 API',brickduel:'跨遊戲管理資料未接通'};
  return [link,game.source,game.status==='playable'?'可遊玩':'開發中',game.channel,game.version??'未登錄',game.team??'未登錄',management[game.id]??'未提供個別管理資料'];
 });
 toRows($('gamesBody'),rows);
 $('gameCount').textContent=rows.length+' / '+gameCatalog.length+' 款遊戲';
}
$('gameSource').addEventListener('change',renderGameCatalog);
$('gameStatus').addEventListener('change',renderGameCatalog);
