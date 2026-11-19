// SPINREALM casual room client. Server-generated boards and results are authoritative.
// No Neon wallet, ranked rating, or real-money rights are changed by this page.
import { CONFIG } from './config.mjs';
import { SHAPES, COLORS, HIDDEN, HEIGHT, WIDTH } from './engine.mjs';
import { predictionFromSnapshot } from './prediction.mjs';
import { InputRepeater } from './input.mjs';
import { RoomClient } from './room-client.mjs';

const $=id=>document.getElementById(id);
const INPUT_KEYS={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'soft',KeyA:'left',KeyD:'right',KeyS:'soft',KeyZ:'ccw',KeyX:'cw',KeyW:'cw',KeyQ:'ccw',Space:'hard',KeyC:'hold',KeyE:'hold',ShiftLeft:'hold',ShiftRight:'hold'};
const urlCode=new URLSearchParams(location.search).get('code');
if(urlCode)$('roomCode').value=urlCode.slice(0,10).toUpperCase();
const hasService=Boolean(CONFIG.realtimeUrl);
const localKey='spinrealm.ui.opponentView.v1';
let rivalView='board';
try{rivalView=localStorage.getItem(localKey)==='stats'?'stats':'board';}catch{}
let stage='entry',roster=[],currentState=null,predicted=null,pending=[],you=null,host=false;
const rivalElements=new Map(),heldKeys=new Map();
const room=new RoomClient({
  baseUrl:CONFIG.realtimeUrl||'',
  onMessage:message=>handleMessage(message),
  onStatus:status=>{
    $('socketStatus').textContent=({connecting:'連線中',connected:'已連線',disconnected:'重新連線中',closed:'未連線'})[status]||status;
    $('socketStatus').dataset.status=status;
    if(status==='disconnected')$('roomBattleNotice').textContent='網路暫時中斷，正嘗試重連；不會補發已確認的操作。';
  }
});
const notice=(message,error=false)=>{$('roomNotice').textContent=message;$('roomNotice').classList.toggle('error',error);};
const showStage=phase=>{
  stage=phase;
  $('roomJoin').hidden=phase!=='entry';
  $('roomLobby').hidden=phase!=='lobby'&&phase!=='ended';
  $('roomPlay').hidden=phase!=='playing'&&phase!=='ended';
};
if(!hasService){
  $('roomCreate').disabled=true;$('roomJoinForm').querySelector('button').disabled=true;
  notice('多人即時伺服器尚未部署。前端與 2～4 人 WebSocket 好友房程式已準備，待設定公開服務網址後才會開放。',true);
  $('socketStatus').textContent='服務未啟用';
}
const clientName=()=>{
  const raw=$('roomNickname').value.trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,20);
  return raw||'旋界玩家';
};
async function connect(action){
  if(!hasService)return;
  const name=clientName();room.displayName=name;
  $('roomCreate').disabled=true;$('roomJoinForm').querySelector('button').disabled=true;
  try{
    const code=action==='create'?await room.create():await room.join($('roomCode').value);
    $('roomCodeLabel').textContent=code;
    notice('成功連線。將房間碼分享給朋友，即可一起玩。');
    showStage('lobby');
  }catch(error){notice('房間連線失敗：'+(error?.message||'請稍後再試'),true);}
  finally{$('roomCreate').disabled=false;$('roomJoinForm').querySelector('button').disabled=false;}
}
$('roomCreate').addEventListener('click',()=>void connect('create'));
$('roomJoinForm').addEventListener('submit',e=>{e.preventDefault();void connect('join');});
$('copyInvite').addEventListener('click',async()=>{
  const invite=new URL('./room.html',location.href);
  invite.searchParams.set('code',room.code);
  try{await navigator.clipboard.writeText(invite.toString());$('roomNotice').textContent='已複製邀請連結。';}
  catch{$('roomNotice').textContent='房間碼：'+room.code;}
});
$('leaveLobby').addEventListener('click',()=>leaveRoom());
$('leaveMatch').addEventListener('click',()=>{
  if(confirm('離開這場即時對戰？已進行的本局無法在此頁暫停。'))leaveRoom();
});
$('roomLaunch').addEventListener('click',()=>{if(host)room.start();});
function leaveRoom(){
  room.close();roster=[];currentState=null;predicted=null;pending=[];you=null;host=false;
  heldKeys.clear();repeater.clear();showStage('entry');notice('已離開房間。');
}
function renderLobby(){
  $('roomRoster').replaceChildren();
  for(const member of roster){
    const card=document.createElement('div');card.className='roster-card'+(member.online?'':' offline');
    const avatar=document.createElement('span');avatar.className='roster-avatar';avatar.textContent=member.name.slice(0,1)||'P';
    const text=document.createElement('div');text.className='roster-meta';
    const strong=document.createElement('strong');strong.textContent=member.name+(member.id===you?'（你）':'');
    const subtitle=document.createElement('span');subtitle.textContent=(member.host?'房主 · ':'')+(member.online?'已連線':'暫時離線');
    text.append(strong,subtitle);card.append(avatar,text);$('roomRoster').append(card);
  }
  const online=roster.filter(m=>m.online).length;
  $('roomLaunch').disabled=!host||online<2||stage==='playing';
  $('roomLaunch').textContent=host?(online<2?'等待至少兩人在線':'開始 '+online+' 人對戰 ↗'):'等待房主開始';
}
function opponentElements(id){
  if(rivalElements.has(id))return rivalElements.get(id);
  const card=document.createElement('article');card.className='rival-card';
  card.dataset.view=rivalView;card.dataset.playerId=id;
  const header=document.createElement('header'),name=document.createElement('strong'),status=document.createElement('small');
  header.append(name,status);
  const canvas=document.createElement('canvas');canvas.width=110;canvas.height=220;canvas.setAttribute('aria-label','對手棋盤');
  const metrics=document.createElement('div');metrics.className='rival-metrics';
  for(const key of ['score','sent','incoming','lines']){
    const item=document.createElement('div'),caption=document.createElement('span'),value=document.createElement('b');
    caption.textContent={score:'得分',sent:'送出',incoming:'待抵消',lines:'消行'}[key];value.dataset.metric=key;
    item.append(caption,value);metrics.append(item);
  }
  card.append(header,canvas,metrics);$('rivalCards').append(card);
  const result={card,name,status,canvas,metrics};rivalElements.set(id,result);
  return result;
}
const color=key=>COLORS[key]||'#65798a';
function canvasPixels(canvas){
  const box=canvas.getBoundingClientRect(),pixelRatio=Math.min(window.devicePixelRatio||1,2);
  const width=Math.max(1,Math.round(box.width*pixelRatio)),height=Math.max(1,Math.round(box.height*pixelRatio));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,width,height);
  return {ctx,width,height};
}
function block(ctx,x,y,size,type,alpha=1){
  if(y < -.1)return;
  ctx.globalAlpha=alpha;ctx.fillStyle=color(type);ctx.fillRect(x+0.5,y+0.5,size-1,size-1);
  ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(x+1,y+1,Math.max(0,size-2),Math.max(1,size*.12));
  ctx.globalAlpha=1;
}
function drawBoard(canvas,game){
  if(!game||!canvas.isConnected||canvas.getBoundingClientRect().width<1)return;
  const {ctx,width,height}=canvasPixels(canvas),unit=Math.min(width/WIDTH,height/20);
  ctx.fillStyle='#091523';ctx.fillRect(0,0,width,height);
  for(let y=0;y<20;y++)for(let x=0;x<WIDTH;x++){
    ctx.fillStyle=(x+y)%2===0?'#14273b':'#102237';ctx.fillRect(x*unit,y*unit,unit-.5,unit-.5);
  }
  if(Array.isArray(game.board))for(let y=HIDDEN;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(game.board[y]?.[x])block(ctx,x*unit,(y-HIDDEN)*unit,unit,game.board[y][x]);
  const active=game.active;
  if(active&&SHAPES[active.type]?.[active.rotation])for(const [x,y] of SHAPES[active.type][active.rotation]){
    const row=active.y+y-HIDDEN;if(row>=0&&row<20)block(ctx,(active.x+x)*unit,row*unit,unit,active.type);
  }
}
function drawPreviews(canvas,types){
  if(!canvas.isConnected||canvas.getBoundingClientRect().width<1)return;
  const {ctx,width,height}=canvasPixels(canvas),items=types.filter(Boolean);
  ctx.fillStyle='#0b1d31';ctx.fillRect(0,0,width,height);
  const slot=height/Math.max(1,items.length),unit=Math.min(width/5,slot/4);
  items.forEach((type,index)=>{
    const shape=SHAPES[type]?.[0];if(!shape)return;
    const xs=shape.map(p=>p[0]),ys=shape.map(p=>p[1]);
    const x0=(width-(Math.max(...xs)-Math.min(...xs)+1)*unit)/2;
    const y0=index*slot+(slot-(Math.max(...ys)-Math.min(...ys)+1)*unit)/2;
    for(const [x,y]of shape)block(ctx,x0+(x-Math.min(...xs))*unit,y0+(y-Math.min(...ys))*unit,unit,type);
  });
}
function predict(game,action){
  if(!game||game.status!=='playing'||!game.active)return;
  switch(action){
    case 'left':game.move(-1);break;
    case 'right':game.move(1);break;
    case 'soft':game.softDrop();break;
    case 'hard':game.hardDrop();break;
    case 'cw':game.rotate(1);break;
    case 'ccw':game.rotate(-1);break;
    case 'hold':game.hold();break;
  }
  game.drainEvents();
}
function displayState(){
  const state=currentState;if(!state)return;
  const me=state.players.find(p=>p.id===you);if(!me?.game)return;
  $('roomClock').textContent=(Math.floor(Math.max(0,state.durationMs-state.elapsedMs)/60000)).toString().padStart(2,'0')+':'+Math.ceil((Math.max(0,state.durationMs-state.elapsedMs)%60000)/1000).toString().padStart(2,'0');
  $('roomScore').textContent=Number(me.game.stats.score||0).toLocaleString();
  $('roomLines').textContent=me.game.stats.lines||0;
  $('roomSent').textContent=me.sent||0;
  $('roomIncoming').textContent=me.incoming||0;
  $('roomPhase').textContent=state.phase==='playing'?'即時對戰中':'比賽已結束';
  if(predicted){
    drawBoard($('roomBoard'),predicted);
    drawPreviews($('roomHold'),[predicted.held]);
    drawPreviews($('roomNext'),predicted.queue.slice(0,5));
  }
  const ids=new Set();
  for(const p of state.players){
    if(p.id===you)continue;ids.add(p.id);
    const item=opponentElements(p.id);
    item.name.textContent=p.name;item.status.textContent=p.game?.status==='over'?'已淘汰':p.online?'對戰中':'斷線';
    item.card.dataset.view=rivalView;
    if(p.game)drawBoard(item.canvas,p.game);
    for(const [name,value] of Object.entries({
      score:p.game?.stats.score||0,sent:p.sent||0,incoming:p.incoming||0,lines:p.game?.stats.lines||0
    }))item.metrics.querySelector('[data-metric="'+name+'"]').textContent=Number(value).toLocaleString();
  }
  for(const [id,item] of rivalElements)if(!ids.has(id)){item.card.remove();rivalElements.delete(id);}
}
function handleMessage(message){
  if(message.type==='welcome'){
    you=message.you;host=Boolean(message.host);
    $('roomCodeLabel').textContent=room.code;
  }else if(message.type==='lobby'){
    roster=Array.isArray(message.players)?message.players:[];
    host=message.host===you;
    if(message.phase==='lobby'||message.phase==='ended'){
      if(stage!=='playing'||message.phase==='ended')showStage(message.phase);
      renderLobby();
    }
  }else if(message.type==='started'){
    pending=[];predicted=null;showStage('playing');
    $('roomBattleNotice').textContent='對戰開始！每一顆方塊都交由伺服器判定。';
    repeater.clear();heldKeys.clear();
  }else if(message.type==='state'){
    currentState=message;
    if(message.phase==='playing'&&stage!=='playing')showStage('playing');
    if(message.phase==='ended')showStage('ended');
    const self=message.players?.find(p=>p.id===you);
    if(self?.game){
      pending=pending.filter(p=>p.seq>(self.ackSeq||0));
      predicted=predictionFromSnapshot(self.game);
      for(const move of pending)predict(predicted,move.action);
    }
    displayState();
  }else if(message.type==='attack'){
    $('roomBattleNotice').textContent='來自對手的攻擊：'+message.lines+' 行，即將入場！';
  }else if(message.type==='ended'){
    const winner=currentState?.players?.find(p=>p.id===message.winner);
    $('roomBattleNotice').textContent=message.winner?(message.winner===you?'這局你贏了！':'獲勝者：'+(winner?.name||'其他玩家')):'這局平手。';
    showStage('ended');renderLobby();
  }else if(message.type==='error'){
    const messages={need_two_players:'至少兩位玩家才能開始',room_full:'房間已滿',match_running:'這局已開始，請等下局',input_rate_limited:'操作頻率過高'};
    const text=messages[message.code]||message.code;
    notice(text,true);$('roomBattleNotice').textContent=text;
  }
}
function issueInput(action){
  if(stage!=='playing'||currentState?.phase!=='playing')return;
  const seq=room.input(action);if(!seq)return;
  pending.push({seq,action});
  if(predicted){predict(predicted,action);displayState();}
}
const repeater=new InputRepeater(()=>({das:210,arr:35,soft:35}),issueInput);
const fingerButtons=document.querySelectorAll('[data-room-action]');
for(const button of fingerButtons){
  const action=button.dataset.roomAction,repeating=['left','right','soft'].includes(action);
  button.addEventListener('pointerdown',e=>{
    if(stage!=='playing')return;
    e.preventDefault();button.setPointerCapture(e.pointerId);button.classList.add('pressed');
    if(repeating)repeater.press(action,{minDas:260});else issueInput(action);
  });
  const release=()=>{button.classList.remove('pressed');if(repeating)repeater.release(action);};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('click',e=>{if(e.detail===0)issueInput(action);});
}
document.addEventListener('keydown',e=>{
  if(stage!=='playing'||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.target.closest?.('button')&&['Space','Enter'].includes(e.code))return;
  const action=INPUT_KEYS[e.code];if(!action)return;
  e.preventDefault();
  if(e.repeat||heldKeys.has(e.code))return;
  heldKeys.set(e.code,action);repeater.press(action,{minDas:190});
});
document.addEventListener('keyup',e=>{
  const action=heldKeys.get(e.code);heldKeys.delete(e.code);
  if(action&&![...heldKeys.values()].includes(action))repeater.release(action);
});
window.addEventListener('blur',()=>{repeater.clear();heldKeys.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){repeater.clear();heldKeys.clear();}});
document.querySelectorAll('[data-rival-view]').forEach(button=>button.addEventListener('click',()=>{
  rivalView=button.dataset.rivalView;
  try{localStorage.setItem(localKey,rivalView);}catch{}
  document.querySelectorAll('[data-rival-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rivalView===rivalView)));
  displayState();
}));
for(const b of document.querySelectorAll('[data-rival-view]'))b.setAttribute('aria-pressed',String(b.dataset.rivalView===rivalView));
let lastFrame=0;
function frame(now){
  const dt=lastFrame?Math.min(32,Math.max(0,now-lastFrame)):0;lastFrame=now;
  if(stage==='playing')repeater.step(dt,{maxHorizontalRepeats:1});
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('resize',displayState);
window.addEventListener('beforeunload',()=>room.close());
