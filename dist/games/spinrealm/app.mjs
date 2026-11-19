import { Game, COLORS, SHAPES, WIDTH, HEIGHT, HIDDEN } from './engine.mjs';
import { Bot } from './bot.mjs';
import { InputRepeater } from './input.mjs';
import { resolveExchange } from './combat.mjs';
import { ITEMS, PARTY_REASON_TEXT, createPartyState, chargeEnergy, getPartyStatus, canUseItem, useItem, absorbGarbage, chooseCpuItem } from './party.mjs';
import { createSoundController } from './sound.mjs';
import { initLocalization, t, translate, subscribeLocale } from './i18n.mjs';
import { drawBlock, drawBoardBackground, applyAppearance } from './appearance.mjs';
import { initMemberUI } from './member-ui.mjs';
import { memberState, refreshProfile, consumeInventory } from './member-client.mjs';
import { RankedClient } from './ranked-client.mjs';
import { createGamepadController } from './gamepad.mjs';
import { saveLocalResult, bestLocalScore } from './local-stats.mjs';
import { predictionFromSnapshot } from './prediction.mjs';

const $ = id => document.getElementById(id);
const DEFAULT_KEYS = {left:'ArrowLeft',right:'ArrowRight',soft:'ArrowDown',hard:'Space',cw:'KeyX',ccw:'KeyZ',hold:'KeyC',pause:'KeyP'};
const KEY_LAYOUTS = {classic:{...DEFAULT_KEYS},wasd:{left:'KeyA',right:'KeyD',soft:'KeyS',hard:'Space',cw:'KeyW',ccw:'KeyQ',hold:'KeyE',pause:'KeyP'}};
const ACTION_LABELS = {left:'向左',right:'向右',soft:'軟降',hard:'硬降',cw:'順時針',ccw:'逆時針',hold:'暫存交換',pause:'暫停'};
const DEFAULTS = {das:210,arr:35,soft:25,lock:500,sound:false,musicVolume:28,sfxVolume:60,boardSize:'large',reduce:false,keys:{...DEFAULT_KEYS}};
const PRESETS = {steady:{das:150,arr:35,soft:35,lock:550},crisp:{das:110,arr:16,soft:20,lock:450},fast:{das:80,arr:0,soft:0,lock:350}};
const SIDEBAR_STORAGE_KEY = 'spinrealm.ui.sidebar.v1';
const OPPONENT_VIEW_KEY = 'spinrealm.ui.opponentView.v1';
let opponentView = 'board';
try { opponentView = localStorage.getItem(OPPONENT_VIEW_KEY) === 'stats' ? 'stats' : 'board'; } catch {}
let sidebarExpanded = false;
try { sidebarExpanded = localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'expanded'; } catch {}
let settings = structuredClone(DEFAULTS);
let drillWins = 0;
try {
  const saved=JSON.parse(localStorage.getItem('spinrealm.handling.v1')||'null');
  if(saved) {
    for(const [key,min,max] of [['das',60,250],['arr',0,70],['soft',0,100],['lock',200,1000],['musicVolume',0,100],['sfxVolume',0,100]]) if(Number.isFinite(saved[key])) settings[key]=Math.min(max,Math.max(min,saved[key]));
    settings.sound=!!saved.sound;settings.reduce=!!saved.reduce;settings.boardSize=saved.boardSize==='standard'?'standard':'large';
    if(saved.keys && Object.values(DEFAULT_KEYS).length===Object.keys(saved.keys).length && new Set(Object.values(saved.keys)).size===8 && Object.keys(DEFAULT_KEYS).every(k=>typeof saved.keys[k]==='string')) settings.keys={...saved.keys};
  }
  drillWins=Math.max(0,parseInt(localStorage.getItem('spinrealm.drills.v1')||'0',10)||0);
} catch {}

const MODES = {
  ranked:{index:'05 / RANKED ARENA',title:'真人排位',desc:'與真人玩家即時交手。相同方塊序列、固定規則，勝負與金幣由伺服器結算。',rule:'120 秒 · 真人隨機配對<br>排位禁止道具 · 前 5 場定位',start:'尋找對手',kicker:'YOUR NEXT RIVAL',headline:'這一局，<br>真人見真章。',text:'公平配對，靠手感上分。<br>登入後開始尋找對手。',hint:'線上測試季 · 沒有玩家時會持續等待'},
  duel:{index:'01 / COUNTERPLAY',title:'120 秒反擊局',desc:'看準來襲的壓力，留住最後一轉的餘裕。把對手的攻擊，變成你的反擊。',rule:'擊頂立即獲勝<br>時間到，比實際送出的行數',start:'開始對戰',kicker:'FIND YOUR FLOW',headline:'久違了，<br>你的下一手。',text:'旋轉、消行、反擊。<br>這次，先讓手指說話。',hint:'本機 CPU 陪練 · 120 秒一局'},
  party:{index:'02 / TACTICAL PARTY',title:'道具派對',desc:'消行與落子累積能量，把防守與反擊留在最需要的時刻。你和 MICA 用同一套道具規則。',rule:'120 秒 · 擊頂或淨送出行數決勝<br>護盾、淨化、震波，共用 8 秒冷卻',start:'開始派對',kicker:'MAKE YOUR NEXT MOVE',headline:'多一手，<br>換你出招。',text:'護住棋盤，清掉垃圾。<br>再用震波，把壓力送回去。',hint:'本機 CPU · 公平充能 · 按 1 / 2 / 3 使用道具'},
  practice:{index:'03 / FIND YOUR FLOW',title:'自由練習',desc:'不用追趕誰。試試不同的旋轉、堆疊和速度，找到自己的節奏。',rule:'不計勝負，不限時間<br>按 U 撤銷上一手，再試一次',start:'開始練習',kicker:'TAKE YOUR TIME',headline:'慢慢來，<br>手感會回來。',text:'把每一次失手，<br>變成下一次順手。',hint:'無對手 · 可撤銷上一手'},
  drill:{index:'04 / ONE LAST SPIN',title:'T-Spin 道場',desc:'還記得那種「明明進不去，轉一下就進去了」的感覺嗎？洞型已經替你排好。',rule:'① X 或 ↑ 順時針旋轉<br>② Space 硬降，完成雙消',start:'進入這一手',kicker:'ONE LAST SPIN',headline:'就是那個洞。<br>轉進去。',text:'先順時針旋轉一次，<br>再硬降，親手消掉兩行。',hint:'不會自動下落 · 可無限重練'}
};

let mode='duel', phase='ready', player, cpu, bot;
let matchSeed=1, elapsed=0, accumulator=0, lastFrame=0;
let incomingPlayer=[], incomingCpu=[], sent=0, cpuSent=0, cancelled=0;
let calloutUntil=0, toastUntil=0, lastUi=0, pendingBinding=null;
const sound=createSoundController({music:settings.musicVolume/100,sfx:settings.sfxVolume/100,muted:!settings.sound});
let audioPreview=false, audioScene=null, audioSfxPreviewUntil=0, audioPreviewId=0;
let playerParty=createPartyState(),cpuParty=createPartyState();
let playerItemAttack=0,cpuItemAttack=0,nextCpuItemAt=0;
let boardFitPending=false,lastLayoutKey='',ticketBusy=false,rankSnapshot=null,lastNetworkError=0;
let memberUI;
const ITEM_KEYS={Digit1:'shield',Digit2:'cleanse',Digit3:'pulse'};
const isVersus=()=>['duel','party','ranked'].includes(mode);
let holdGuide=null, drillAltered=false, lastDrillResult=null;
const heldCodes=new Map();
const repeater=new InputRepeater(()=>settings, perform);
const canvasContexts=new Map();
const FIXED_DT=1000/120;

function newSeed(){const a=new Uint32Array(1);if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(a);else a[0]=Date.now();return a[0]||1;}
function storeSettings(){try{localStorage.setItem('spinrealm.handling.v1',JSON.stringify(settings));}catch{}}
function keyName(code){return {ArrowLeft:'←',ArrowRight:'→',ArrowDown:'↓',ArrowUp:'↑',Space:'SPACE',ShiftLeft:'L SHIFT',ShiftRight:'R SHIFT',Enter:'ENTER',Backspace:'⌫'}[code]||code.replace(/^Key/,'').replace(/^Digit/,'').toUpperCase();}
function keyLabels(action){
  const aliases={cw:['ArrowUp'],hold:['ShiftLeft','ShiftRight']}[action]||[];
  const codes=[...new Set([settings.keys[action],...aliases])].filter(code=>actionFor(code)===action);
  const bothShift=codes.includes('ShiftLeft')&&codes.includes('ShiftRight');
  const labels=codes.filter(code=>!bothShift||code!=='ShiftRight').map(code=>bothShift&&code==='ShiftLeft'?'SHIFT':keyName(code));
  return labels.join(' / ');
}
function keyboardLayout(){return Object.keys(KEY_LAYOUTS).find(name=>Object.entries(KEY_LAYOUTS[name]).every(([action,code])=>settings.keys[action]===code))||'custom';}
function inform(message){$('globalToast').textContent=translate(message);$('globalToast').classList.add('show');toastUntil=performance.now()+2600;}
function clearInputs(){repeater.clear();heldCodes.clear();document.querySelectorAll('[data-action].pressed').forEach(b=>b.classList.remove('pressed'));}
function setOpponentView(view){
  if(!['board','stats'].includes(view))return;
  opponentView=view;
  try{localStorage.setItem(OPPONENT_VIEW_KEY,view);}catch{}
  $('opponentBoardPanel').hidden=view!=='board';
  $('opponentStatsPanel').hidden=view!=='stats';
  document.querySelectorAll('[data-opponent-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.opponentView===view)));
  draw();
}

function syncAudio(){
  const next=document.hidden?'paused':audioPreview?'playing':performance.now()<audioSfxPreviewUntil?'ended':phase==='running'?'playing':phase==='paused'?'paused':'ended';
  if(next!==audioScene){audioScene=next;sound.setScene(next);}
}
function initAudio(){if(!settings.sound)return;syncAudio();void sound.unlock();}
function tone(kind){if(settings.sound)sound.play(kind);}
function updateAudioControls(){
  $('audioEnabled').checked=settings.sound;
  $('musicVolume').value=settings.musicVolume;$('musicVolumeValue').textContent=settings.musicVolume+'%';
  $('sfxVolume').value=settings.sfxVolume;$('sfxVolumeValue').textContent=settings.sfxVolume+'%';
  $('soundBtn').classList.toggle('sound-enabled',settings.sound);
  $('soundBtn').setAttribute('aria-label',`音樂與音效（${settings.sound?'已開啟':'已靜音'}）`);
  $('soundBtn').title=settings.sound?'音樂與音效 · 已開啟':'音樂與音效 · 已靜音';
  $('testMusic').setAttribute('aria-pressed',String(audioPreview));
  $('testMusic').textContent=audioPreview?'停止試聽':'試聽音樂';
  sound.setVolumes({music:settings.musicVolume/100,sfx:settings.sfxVolume/100,muted:!settings.sound});
  syncAudio();
}
function updateAudioStatus(){
  if(!$('audioDialog').open)return;
  const state=sound.getState();
  const text=!settings.sound?'目前靜音。開啟後可分別調整音樂與音效。':state.musicFailed?'背景音樂暫時無法載入，遊戲仍可繼續。':state.musicBlocked?'瀏覽器尚未允許播放，請再按一次「試聽音樂」。':audioPreview?(settings.musicVolume===0?'音樂音量是 0%，拉高滑桿即可聆聽。':state.musicReady&&state.musicPlaying?'正在播放 Exploration Theme · Cleyton Kauffman':state.musicPlaying?'音樂載入中…':'正在準備音樂…'):state.failedEffects?'部分音效未能載入；可繼續遊戲，稍後重新整理重試。':state.unlocked?`音效已載入 ${state.loadedEffects} / 10。對局開始後播放音樂，暫停時一起停下。`:'按「試聽」或開始一局，啟用聲音。';
  if($('audioFeedback').textContent!==text)$('audioFeedback').textContent=text;
}
function resetAudioPreview(){audioPreview=false;audioSfxPreviewUntil=0;audioPreviewId++;updateAudioControls();}

function partyNotice(text){if($('itemNotice').textContent!==text)$('itemNotice').textContent=text;}
function triggerItem(id,isCpu=false,ticket=false){
  if(mode!=='party'||phase!=='running')return false;
  const originalEnergy=playerParty.energy;
  const itemState=ticket?{...playerParty,energy:Math.max(playerParty.energy,ITEMS[id].cost)}:isCpu?cpuParty:playerParty;
  const result=useItem(itemState,id,elapsed,{game:isCpu?cpu:player});
  if(ticket&&result.ok)result.state.energy=originalEnergy;
  if(!result.ok){if(!isCpu)inform(PARTY_REASON_TEXT[result.reason]||'這個道具目前無法使用。');return false;}
  if(isCpu){cpuParty=result.state;cpuItemAttack+=result.attack;}
  else{playerParty=result.state;playerItemAttack+=result.attack;initAudio();tone('item');}
  const detail=id==='cleanse'?`清除 ${result.removed} 行垃圾`:id==='shield'?'8 秒內最多擋下 4 行':'送出 2 行攻擊，照常先抵消';
  partyNotice(`${isCpu?'MICA':'你'}使用${ITEMS[id].name} · ${detail}`);
  return true;
}
function usePlayerItem(id){if(!ticketBusy&&triggerItem(id)){handleEvents();updateUI();draw();}}
function updatePartyUI(){
  const party=mode==='party';$('partyPanel').hidden=!party;$('cpuPartyStatus').hidden=!party;
  if(!party)return;
  const inventory=memberState().profile?.inventory||[];
  $('ticketControls').hidden=!inventory.some(row=>row.quantity>0);
  document.querySelectorAll('[data-ticket]').forEach(b=>{const quantity=inventory.find(row=>row.itemId===b.dataset.ticket)?.quantity||0;b.querySelector('b').textContent=quantity;b.disabled=ticketBusy||phase!=='running'||quantity<1;});
  const p=getPartyStatus(playerParty,elapsed),c=getPartyStatus(cpuParty,elapsed);
  $('partyEnergyValue').textContent=`${p.energy} / ${p.energyMax}`;$('partyEnergyBar').value=p.energy;
  $('partyStatus').textContent=phase==='paused'?'暫停 · 計時凍結':p.shieldRemaining?`護盾 ${p.shieldRemaining} 行 · ${(p.shieldRemainingMs/1000).toFixed(1)} 秒`:p.cooldownRemaining?`冷卻 ${(p.cooldownRemaining/1000).toFixed(1)} 秒`:'落子 +5 · 每行 +8';
  $('cpuPartyStatus').textContent=`能量 ${c.energy} / ${c.energyMax}`+(c.shieldRemaining?` · 護盾 ${c.shieldRemaining} 行`:c.cooldownRemaining?` · 冷卻 ${(c.cooldownRemaining/1000).toFixed(1)} 秒`:' · 道具就緒');
  document.querySelectorAll('[data-item]').forEach(button=>{
    const id=button.dataset.item,item=ITEMS[id],allowed=canUseItem(playerParty,id,elapsed,{game:player});
    const key=Object.entries(ITEM_KEYS).find(([,value])=>value===id)[0],keyFree=!actionFor(key);
    button.querySelector('kbd').hidden=!keyFree;
    const reason=phase==='ready'?'開局後可用':phase==='paused'?'暫停中':phase==='ended'?'本局結束':allowed.ok?'可以使用':PARTY_REASON_TEXT[allowed.reason]||'暫時無法使用';
    button.disabled=phase!=='running'||!allowed.ok;
    button.title=`${item.name} · ${item.description} · ${item.cost} 能量 · ${reason}`;
    button.setAttribute('aria-label',`${item.name}，${item.description}，${item.cost} 能量。${reason}${keyFree?`。按 ${keyName(key)}`:''}`);
  });
}

function prepare(seed=newSeed()){
  matchSeed=seed;elapsed=0;accumulator=0;incomingPlayer=[];incomingCpu=[];sent=0;cpuSent=0;cancelled=0;playerParty=createPartyState();cpuParty=createPartyState();playerItemAttack=0;cpuItemAttack=0;nextCpuItemAt=0;partyNotice('雙方使用相同道具規則。每次使用後冷卻 8 秒。');holdGuide=null;drillAltered=false;lastDrillResult=null;clearInputs();
  player=new Game({seed,gravity:700,lockDelay:settings.lock});
  cpu=new Game({seed,gravity:700,lockDelay:settings.lock});
  bot=new Bot(cpu,{pps:Number($('difficulty').value)});
  if(mode==='drill')player.loadDrill('double');
  calloutUntil=0;$('moveCallout').classList.remove('show');
  $('exchangeText').textContent=isVersus()?'消行攻擊會優先抵消來襲行數':'練習模式沒有來襲垃圾行';
  $('arenaCaption').textContent=mode==='drill'?`${keyLabels('cw')} 順轉一次，再按 ${keyName(settings.keys.hard)} 硬降。`:'軟降到底還能轉。硬降會立即固定。';
}

function startHoldGuide(){
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  pendingBinding=null;if(!selectMode('practice'))return;start();
  holdGuide={stage:'store',storedType:player.active.type};
  updateUI();draw();
}
function finishHoldGuide(){holdGuide=null;clearInputs();$('arenaCaption').textContent='引導結束。自由練習開始自動下落，交換仍然每顆一次。';updateUI();$('playerCanvas').focus({preventScroll:true});}
function updateHoldGuide(){
  $('holdGuidePanel').hidden=!holdGuide;
  if(!holdGuide)return;
  const descriptions={
    store:['01 / 先存起來',`按 ${keyLabels('hold')}，或點棋盤左側的「暫存交換」。目前的 ${holdGuide.storedType} 方塊會進 HOLD，NEXT 的下一顆會上場。`],
    place:['02 / 落子才會解鎖',`${holdGuide.storedType} 已存好。現在還不能再交換；先把這顆放好，按 ${keyName(settings.keys.hard)} 硬降並固定。`],
    swap:['03 / 把它換回來',`交換已解鎖。再按 ${keyLabels('hold')} 或點「暫存交換」，取回剛剛存好的 ${holdGuide.storedType}。`],
    done:['完成 / 這顆留給對的時機',`你把 ${holdGuide.storedType} 換回來了。第一次暫存取 NEXT，之後交換 HOLD；每顆固定後才會再次解鎖。`],
  };
  const [title,text]=descriptions[holdGuide.stage];
  $('holdGuideTitle').textContent=title;
  if($('holdGuideText').textContent!==text)$('holdGuideText').textContent=text;
  $('finishHoldGuide').textContent=holdGuide.stage==='done'?'完成，繼續練習':'結束引導';
  const stages=['store','place','swap','done'];
  document.querySelectorAll('[data-hold-step]').forEach(el=>{const index=stages.indexOf(el.dataset.holdStep),current=stages.indexOf(holdGuide.stage);el.classList.toggle('current',index===current);el.classList.toggle('complete',index<current);});
}

function showOverlay({kicker,title,text,button,hint,secondary=false}){
  $('overlayKicker').textContent=kicker;$('overlayTitle').innerHTML=title;$('overlayText').innerHTML=text;$('startBtn').innerHTML=button+' <span>↗</span>';$('overlayHint').textContent=hint;$('secondaryBtn').hidden=!secondary;$('overlay').hidden=false;
}
function refreshMode(){
  const m=MODES[mode];
  document.body.classList.toggle('ranked-mode',mode==='ranked');
  $('opponentName').textContent=mode==='ranked'?t('ranked.opponent'):'MICA';$('opponentBadge').textContent=mode==='ranked'?'LIVE':'CPU';$('opponentNote').textContent=mode==='ranked'?t('ranked.sameSequence'):'本機對手 · 同一組方塊序列';
  document.body.classList.toggle('solo',!isVersus());document.body.classList.toggle('party-mode',mode==='party');document.body.classList.toggle('drill',mode==='drill');
  document.querySelectorAll('[data-mode]').forEach(el=>{const selected=el.dataset.mode===mode;el.classList.toggle('active',selected);el.setAttribute('aria-pressed',String(selected));});
  $('modeIndex').textContent=m.index;$('modeTitle').textContent=m.title;$('modeDesc').textContent=m.desc;$('modeRule').innerHTML=m.rule;
  $('clockLabel').textContent=isVersus()?'本局剩餘':mode==='drill'?'練習目標':'練習時間';
  $('pressureTitle').textContent=isVersus()?'INCOMING / 待抵消':'PRACTICE / 自由出手';
  $('retryBtn').querySelector('span').textContent=mode==='drill'?'重新擺好洞型':'重新開始';
  $('undoBtn').disabled=mode!=='practice';
}
function applyMode(next){mode=next;rankSnapshot=null;$('startBtn').disabled=false;phase='ready';prepare();refreshMode();const m=MODES[mode];showOverlay({kicker:m.kicker,title:m.headline,text:m.text,button:m.start,hint:m.hint});updateUI();draw();}
function start(reuse=false){
  if(ticketBusy)return;
  if(mode==='ranked'){void startRanked();return;}
  initAudio();if(phase==='paused'){resume();return;}
  prepare(reuse?matchSeed:newSeed());phase='running';lastFrame=performance.now();$('overlay').hidden=true;$('pauseBtn').disabled=false;$('pauseBtn').textContent='Ⅱ';
  $('playerCanvas').focus({preventScroll:true});updateUI();draw();
}
function pause(){if(phase!=='running')return;if(mode==='ranked'){clearInputs();inform(t('ranked.noPause'));return;}phase='paused';clearInputs();$('pauseBtn').textContent='▶';showOverlay({kicker:'TAKE A BREATH',title:'先歇一下。',text:'棋盤和對手都在等你。',button:'繼續這一局',hint:`按 ${keyName(settings.keys.pause)} 或按鈕繼續`});updateUI();}
function resume(){if(phase!=='paused')return;phase='running';accumulator=0;lastFrame=performance.now();$('overlay').hidden=true;$('pauseBtn').textContent='Ⅱ';$('playerCanvas').focus({preventScroll:true});updateUI();}
function togglePause(){if(ticketBusy)return;if(phase==='running')pause();else if(phase==='paused')resume();}
function end(result){
  if(phase!=='running'||mode==='ranked')return;
  phase='ended';clearInputs();$('pauseBtn').disabled=true;
  if(mode==='drill'){
    lastDrillResult=result;
    const success=result==='drillWin';if(success){drillWins++;try{localStorage.setItem('spinrealm.drills.v1',String(drillWins));}catch{}tone('spin');}
    const exchanged=result==='drillChanged';
    showOverlay({kicker:success?'THAT’S THE FEELING':exchanged?'RESET THE POSITION':'ONE MORE TRY',title:success?'轉進去了！<br><span style="color:var(--purple)">T-SPIN DOUBLE</span>':exchanged?'方塊換過了。<br>重擺洞型再試。':'差一點。<br>再轉一次。',text:success?'消掉 2 行，產生 4 行攻擊。<br>這就是最後一轉的價值。':exchanged?'交換不算完成 T-Spin。<br>重練會還原 T 方塊與洞型。':`先按 ${keyLabels('cw')} 順轉一次，<br>確認卡進洞裡，再按 ${keyName(settings.keys.hard)} 硬降。`,button:'再練這一手',hint:`已成功 ${drillWins} 次 · 多試幾次，找回肌肉記憶`});
  }else if(mode==='practice'){
    tone('over');showOverlay({kicker:'KEEP THE GOOD MOVES',title:'這局到這裡。',text:`你放了 ${player.stats.pieces} 塊，消掉 ${player.stats.lines} 行。<br>按 U 撤銷上一手，也可以重新開始。`,button:'再練一局',hint:`T-SPIN ${player.stats.spins} 次 · 沒有白玩的練習`,secondary:true});
  }else{
    const win=result==='win',tie=result==='tie';tone(win?'win':'over');
    showOverlay({kicker:tie?'EVENLY MATCHED':win?'YOUR COUNTERPLAY':'THE NEXT ONE IS YOURS',title:tie?'這局，平手。':win?'這局，你拿下了。':'再來，<br>換你反擊。',text:`你的淨送出 <b>${sent}</b> 行 · CPU <b>${cpuSent}</b> 行<br>你抵消了 ${cancelled} 行來襲攻擊。`,button:'再戰一局',hint:'新局換一組方塊；同局重來保留序列',secondary:true});
  }
  saveLocalResult({mode,result,score:player.stats.score,lines:player.stats.lines,spins:player.stats.spins,pieces:player.stats.pieces,durationMs:Math.round(elapsed)});
  if(mode!=='drill')$('overlayHint').textContent=t('score.summary',{score:player.stats.score,best:bestLocalScore(mode)});
  updateUI();draw();
}

function predictAction(game,action){
  if(game.status!=='playing'||!game.active)return false;
  if(action==='left')return game.move(-1);
  if(action==='right')return game.move(1);
  if(action==='soft')return game.softDrop();
  if(action==='cw')return game.rotate(1);
  if(action==='ccw')return game.rotate(-1);
  if(action==='hold')return game.hold();
  if(action==='hard'){game.hardDrop();return true;}
  return false;
}
const ranked=new RankedClient({
  onQueue(data){
    if(mode!=='ranked')return;
    if(data.status==='idle'){phase='ready';showRankedReady();return;}
    phase='ready';clearInputs();
    showOverlay({kicker:'ONLINE MATCHMAKING',title:t(data.status==='matched'?'ranked.found':'ranked.searching'),text:t('ranked.noCpu'),button:t('ranked.searching'),hint:t('ranked.waiting'),secondary:true});
    $('startBtn').disabled=true;$('secondaryBtn').textContent=t('ranked.leave');
  },
  onSnapshot(data,pending){
    if(mode!=='ranked')return;
    const first=!rankSnapshot;rankSnapshot=data;
    const me=data.you,other=Object.keys(data.games).find(id=>id!==me);
    player=predictionFromSnapshot(data.games[me]);cpu=predictionFromSnapshot(data.games[other]);
    // Prediction has no authority: scores, attacks, ratings and rewards always come back from the server.
    for(const input of pending)predictAction(player,input.action);
    player.drainEvents();
    incomingPlayer=structuredClone(data.incoming[me]||[]);incomingCpu=structuredClone(data.incoming[other]||[]);
    sent=data.totals[me].sent;cpuSent=data.totals[other].sent;cancelled=data.totals[me].cancelled;elapsed=data.elapsedMs;
    $('opponentName').textContent=data.players[other]?.nickname||t('ranked.opponent');
    $('opponentName').setAttribute('translate','no');
    if(data.status==='ended'){
      phase='ended';clearInputs();$('startBtn').disabled=false;$('pauseBtn').disabled=true;
      const settlement=data.settlement?.[me],outcome=settlement?.outcome||'void';
      showOverlay({kicker:'SERVER VERIFIED',title:t('ranked.result.'+outcome),text:t('ranked.settlement',{score:data.games[me].stats.score,before:settlement?.ratingBefore??0,after:settlement?.ratingAfter??0,coins:settlement?.coins??0}),button:t('ranked.again'),hint:t(settlement?.coins?'ranked.rewarded':'ranked.noReward')});
      tone(outcome==='win'?'win':'over');void refreshProfile({apply:false}).catch(()=>{});
    }else if(data.countdownMs>0){
      phase='ready';showOverlay({kicker:'READY TO PLAY',title:String(Math.ceil(data.countdownMs/1000)),text:t('ranked.sameSequence'),button:t('ranked.starting'),hint:t('ranked.noPause')});$('startBtn').disabled=true;
    }else{
      const starting=phase!=='running';phase='running';$('overlay').hidden=true;$('startBtn').disabled=false;
      if(starting){accumulator=0;lastFrame=performance.now();initAudio();if(!document.querySelector('dialog[open]'))$('playerCanvas').focus({preventScroll:true});}
    }
    if(first)scheduleBoardFit();updateUI();draw();
  },
  onError(error){
    if(performance.now()-lastNetworkError<4000)return;lastNetworkError=performance.now();
    const key='errors.'+error.code;inform(t(key)===key?t('ranked.reconnecting'):t(key));
  }
});
function showRankedReady(){const m=MODES.ranked;$('startBtn').disabled=false;showOverlay({kicker:m.kicker,title:m.headline,text:m.text,button:m.start,hint:m.hint});updateUI();}
async function startRanked(){
  if(ranked.matchId)return;if(!memberState().user){memberUI?.open('account');return;}
  if(ranked.queued)return;rankSnapshot=null;prepare();await ranked.join();
}
async function leaveRanked(){
  try{await ranked.leave();if(!ranked.matchId)showRankedReady();}catch(error){inform(t('errors.'+error.code));}
}
let nextAfterLeave='ranked';
const leaveDialog=document.createElement('dialog');leaveDialog.className='modal';leaveDialog.id='leaveRankedDialog';
leaveDialog.innerHTML='<h2 data-i18n="ranked.leaveTitle">離開這場排位？</h2><p data-i18n="ranked.leaveWarning">比賽進行中離開會判負，對手會收到結果。</p><div class="modal-bottom"><button class="secondary-button" id="stayRanked" data-i18n="common.cancel">取消</button><button class="primary-button compact" id="confirmLeaveRanked" data-i18n="ranked.forfeit">認輸並離開</button></div>';
document.body.append(leaveDialog);
function showLeaveDialog(next){nextAfterLeave=next;clearInputs();if(!leaveDialog.open)leaveDialog.showModal();}
$('stayRanked').addEventListener('click',()=>leaveDialog.close());
$('confirmLeaveRanked').addEventListener('click',async()=>{try{$('confirmLeaveRanked').disabled=true;await ranked.forfeit();leaveDialog.close();applyMode(nextAfterLeave);}catch(error){inform(t('errors.'+error.code));}finally{$('confirmLeaveRanked').disabled=false;}});
function selectMode(next){
  if(ticketBusy)return false;
  if(ranked.matchId){if(next!==mode)showLeaveDialog(next);return false;}
  if(ranked.queued){void ranked.leave().then(()=>{if(ranked.matchId)showLeaveDialog(next);else applyMode(next);}).catch(()=>inform(t('ranked.reconnecting')));return false;}
  applyMode(next);return true;
}
function performRanked(action,all=false){
  if(!rankSnapshot||rankSnapshot.countdownMs>0||!ranked.matchId)return;
  const count=all?(action==='soft'?HEIGHT+4:WIDTH+2):1;
  for(let i=0;i<count;i++){
    if(!ranked.input(action))break;
    const moved=predictAction(player,action);
    for(const event of player.drainEvents())if(event.type==='lock')callout(event);
    if(!moved)break;
  }
  if(action==='cw'||action==='ccw')tone('rotate');else if(action==='hold')tone('hold');else if(action==='left'||action==='right')tone('move');
}
async function useTicket(id){
  if(ticketBusy||mode!=='party'||phase!=='running')return;
  const possible=canUseItem({...playerParty,energy:100},id,elapsed,{game:player});
  if(!possible.ok){inform(PARTY_REASON_TEXT[possible.reason]);return;}
  ticketBusy=true;pause();inform(t('shop.usingTicket'));
  try{await consumeInventory(id);resume();if(triggerItem(id,false,true)){handleEvents();updateUI();draw();}}
  catch(error){inform(t('errors.'+error.code));if(phase==='paused')resume();}
  finally{ticketBusy=false;clearInputs();}
}
document.querySelectorAll('[data-ticket]').forEach(button=>button.addEventListener('click',()=>void useTicket(button.dataset.ticket)));
const gamepad=createGamepadController({
  enabled:()=>!document.querySelector('dialog[open]')&&['running','paused'].includes(phase),
  press:action=>repeater.press(action,{minDas:220}),
  release:action=>{if(![...heldCodes.values()].includes(action))repeater.release(action);},
  pause:togglePause,onConnect:()=>inform(t('controller.connected'))
});

function applyReady(game,queue){
  while(queue.length&&queue[0].at<=elapsed){
    const item=queue.shift();let rows=item.n;
    if(mode==='party'){
      const ours=game===player,result=absorbGarbage(ours?playerParty:cpuParty,rows,elapsed);
      if(ours)playerParty=result.state;else cpuParty=result.state;
      rows=result.remaining;
      if(result.absorbed){partyNotice(`${ours?'你的':'MICA 的'}護盾擋下 ${result.absorbed} 行垃圾`);if(ours)tone('item');}
    }
    if(rows)game.addGarbage(rows);
    if(game.status==='over')break;
  }
}

function callout(event){
  let title='',detail='';
  if(event.perfectClear){title='ALL CLEAR';detail='全清 · 漂亮';}
  else if(event.spin){title=event.spin==='mini'?'T-SPIN MINI':'T-SPIN';detail=['','SINGLE','DOUBLE','TRIPLE'][event.lines]||'旋轉成功';}
  else if(event.lines===4){title='QUAD';detail='一次清四行';}
  else if(event.combo>0){title=`${event.combo} COMBO`;detail=`連續消行 · 攻擊 +${event.attack}`;}
  else if(event.lines>0){title=['','SINGLE','DOUBLE','TRIPLE'][event.lines];detail=event.attack?`攻擊 +${event.attack}`:'消掉一行';}
  if(title){$('moveCallout').innerHTML=title+`<small>${detail}</small>`;$('moveCallout').classList.add('show');calloutUntil=performance.now()+1050;}
  if(event.lines&&!settings.reduce){$('clearFlash').classList.remove('flash');void $('clearFlash').offsetWidth;$('clearFlash').classList.add('flash');}
  if(event.spin)tone('spin');else if(event.lines)tone('clear');else tone('drop');
}
function handleEvents(){
  const pe=player.drainEvents(),ce=cpu.drainEvents();
  let drillResult=null;
  const playerLocks=pe.filter(e=>e.type==='lock'),cpuLocks=ce.filter(e=>e.type==='lock');
  for(const e of pe){
    if(e.type!=='lock')continue;
    callout(e);
    if(holdGuide?.stage==='place')holdGuide.stage='swap';
    else if(holdGuide?.stage==='store')holdGuide.storedType=player.active.type;
    if(mode==='drill'){drillResult=drillAltered?'drillChanged':e.placedType==='T'&&e.spin==='full'&&e.lines===2?'drillWin':'drillFail';continue;}
  }
  if(mode==='party'){
    for(const event of playerLocks)playerParty=chargeEnergy(playerParty,event);
    for(const event of cpuLocks)cpuParty=chargeEnergy(cpuParty,event);
  }
  if(isVersus()){
    const playerAttack=playerLocks.reduce((a,e)=>a+e.attack,0)+playerItemAttack,cpuAttack=cpuLocks.reduce((a,e)=>a+e.attack,0)+cpuItemAttack;
    playerItemAttack=0;cpuItemAttack=0;
    const exchange=resolveExchange({playerQueue:incomingPlayer,cpuQueue:incomingCpu,playerAttack,cpuAttack,now:elapsed});
    sent+=exchange.playerSent;cpuSent+=exchange.cpuSent;cancelled+=exchange.playerCancelled;
    if(playerAttack)$('exchangeText').textContent=`這一手：抵消 ${exchange.playerCancelled} 行 / 送出 ${exchange.playerSent} 行`;
    if(exchange.cpuSent)tone('incoming');
    if(playerLocks.length)applyReady(player,incomingPlayer);
    if(cpuLocks.length)applyReady(cpu,incomingCpu);
  }
  if(drillResult){end(drillResult);return;}
  if(isVersus()){
    if(player.status==='over'||cpu.status==='over')end(player.status==='over'?(cpu.status==='over'?'tie':'loss'):'win');
  }else if(player.status==='over')end('over');
}

function perform(action,all=false){
  if(phase!=='running'||ticketBusy)return;
  if(mode==='ranked'){performRanked(action,all);return;}
  let moved=false;
  if(action==='left'||action==='right'){
    const d=action==='left'?-1:1;if(all){for(let i=0;i<WIDTH+2;i++){if(!player.move(d))break;moved=true;}}else moved=player.move(d);
    if(moved)tone('move');
  }else if(action==='soft'){
    if(all){for(let i=0;i<HEIGHT+4;i++){if(!player.softDrop())break;moved=true;}}else moved=player.softDrop();
  }else if(action==='cw'||action==='ccw'){moved=player.rotate(action==='cw'?1:-1);if(moved)tone('rotate');}
  else if(action==='hard')player.hardDrop();
  else if(action==='hold'){
    if(player.hold()){
      tone('hold');
      if(holdGuide?.stage==='store'){holdGuide.storedType=player.held;holdGuide.stage='place';}
      else if(holdGuide?.stage==='swap')holdGuide.stage='done';
      if(mode==='drill'){drillAltered=true;inform('已交換方塊。這次不計道場完成；按 R 可還原 T 方塊與洞型。');}
    }else if(!player.canHold)inform('先固定目前這顆，暫存交換才會解鎖。');
    updateUI();draw();
  }
  handleEvents();
}

function undo(){
  if(mode!=='practice'){inform('撤銷只在自由練習開放。對戰要一手一手算數。');return;}
  if(player.undo()){holdGuide=null;phase='running';$('overlay').hidden=true;$('pauseBtn').disabled=false;$('pauseBtn').textContent='Ⅱ';clearInputs();inform('回到上一手開始時。這次試另一種放法。');updateUI();draw();}
  else inform('先放下一顆方塊，就可以撤銷重練。');
}

function step(dt){
  if(phase!=='running')return;
  if(mode!=='drill'&&!holdGuide)player.step(dt);
  if(mode==='ranked'){player.drainEvents();return;}
  if(isVersus()){cpu.step(dt);bot.update(dt);}
  if(mode==='party'&&elapsed>=nextCpuItemAt){
    nextCpuItemAt=elapsed+500;
    const item=chooseCpuItem(cpuParty,elapsed,{game:cpu,incoming:incomingCpu});
    if(item)triggerItem(item,true);
  }
  handleEvents();
}

function ctxFor(canvas){
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  let ctx=canvasContexts.get(canvas);if(!ctx){ctx=canvas.getContext('2d');canvasContexts.set(canvas,ctx);}return ctx;
}
function block(ctx,x,y,size,color,options={}){drawBlock(ctx,x,y,size,color,options);}
function drawBoard(canvas,game,isPlayer=false){
  const ctx=ctxFor(canvas),w=canvas.width,h=canvas.height,s=w/WIDTH;
  drawBoardBackground(ctx,w,h,{columns:WIDTH,rows:20,custom:isPlayer});
  for(let y=HIDDEN;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(game.board[y][x])block(ctx,x*s,(y-HIDDEN)*s,s,COLORS[game.board[y][x]]||COLORS.G);
  if(game.status==='playing'&&game.active){
    const ghost=game.ghost();
    if(isPlayer)for(const [x,y] of game.cells(ghost))if(y>=HIDDEN)block(ctx,x*s,(y-HIDDEN)*s,s,COLORS[game.active.type],{ghost:true});
    for(const [x,y] of game.cells())if(y>=HIDDEN)block(ctx,x*s,(y-HIDDEN)*s,s,COLORS[game.active.type],{active:true});
    if(isPlayer&&game.cells().every(([,y])=>y<HIDDEN)){
      const cells=game.cells();const minX=Math.min(...cells.map(c=>c[0])),maxX=Math.max(...cells.map(c=>c[0]));ctx.fillStyle=COLORS[game.active.type]+'90';ctx.fillRect(minX*s+1,0,(maxX-minX+1)*s-2,Math.max(2,s*.08));
    }
    if(isPlayer&&game._grounded()&&mode!=='drill'){
      const ratio=Math.min(1,game._lockTimer/settings.lock);ctx.fillStyle='#ffffff15';ctx.fillRect(0,h-3,w,3);ctx.fillStyle=COLORS[game.active.type];ctx.fillRect(0,h-3,w*(1-ratio),3);
    }
  }
  if(isPlayer&&incomingPlayer.length){ctx.fillStyle='#ff8b8322';ctx.fillRect(0,h-3*s,w,3*s);}
}
function drawPieces(canvas,types,dim=false){
  const ctx=ctxFor(canvas),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);const slot=types.length>1?h/5:h;
  types.forEach((type,i)=>{if(!type)return;const shape=SHAPES[type][0],size=Math.min(w/4.8,slot/3.1),minX=Math.min(...shape.map(c=>c[0])),maxX=Math.max(...shape.map(c=>c[0])),minY=Math.min(...shape.map(c=>c[1])),maxY=Math.max(...shape.map(c=>c[1]));const ox=(w-(maxX-minX+1)*size)/2,oy=i*slot+(slot-(maxY-minY+1)*size)/2;ctx.globalAlpha=dim?.35:1;for(const[x,y]of shape)block(ctx,ox+(x-minX)*size,oy+(y-minY)*size,size,COLORS[type]);ctx.globalAlpha=1;});
}
function draw(){if(!player)return;drawBoard($('playerCanvas'),player,true);if(isVersus()&&cpu&&opponentView==='board')drawBoard($('cpuCanvas'),cpu,false);drawPieces($('holdCanvas'),[player.held],!player.canHold);drawPieces($('nextCanvas'),player.queue.slice(0,5));}

function updateUI(){
  if(!player)return;
  const stats=mode==='ranked'&&rankSnapshot?rankSnapshot.games[rankSnapshot.you].stats:player.stats;
  $('difficulty').disabled=ticketBusy||mode==='ranked';
  document.body.classList.toggle('in-session',phase!=='ready');document.body.classList.toggle('is-playing',phase==='running');
  document.body.classList.toggle('hold-learning',Boolean(holdGuide));
  const total=incomingPlayer.reduce((a,v)=>a+v.n,0),seconds=isVersus()?Math.max(0,Math.ceil((120000-elapsed)/1000)):Math.floor(elapsed/1000);
  $('clock').textContent=mode==='drill'?'TSD':`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  $('clock').parentElement.classList.toggle('danger',isVersus()&&seconds<=15&&phase==='running');
  $('scoreValue').textContent=stats.score.toLocaleString();$('linesValue').textContent=stats.lines;$('sentValue').textContent=isVersus()?sent:stats.attack;$('sentValue').previousElementSibling.textContent=isVersus()?'淨送出':'產生攻擊';
  $('ppsValue').textContent=(elapsed>500?stats.pieces/(elapsed/1000):0).toFixed(2);$('spinsValue').textContent=stats.spins;
  $('comboValue').textContent=stats.combo>0?stats.combo:'—';$('b2bValue').textContent=stats.b2b>1?'×'+stats.b2b:'—';
  const holdAvailable=phase==='running'&&player.canHold;
  const holdStatus=phase==='ready'?'開局後可用':phase==='paused'?'暫停中':phase==='ended'?'本局結束':player.canHold?(player.held?'點此交換':'點此存入'):'落子後解鎖';
  if($('holdState').textContent!==holdStatus)$('holdState').textContent=holdStatus;
  $('holdBtn').disabled=!holdAvailable;$('holdBtn').classList.toggle('cooldown',phase==='running'&&!player.canHold);
  $('holdBtn').setAttribute('aria-label',`暫存交換，${player.held?`目前存放 ${player.held} 方塊`:'目前空位'}。${holdStatus}。按鍵 ${keyLabels('hold')}。每顆固定後才會解鎖。`);
  $('holdBtn').title=`${keyLabels('hold')} · ${holdStatus} · 每顆落子只能交換一次`;
  $('holdEmpty').hidden=!!player.held;
  document.querySelectorAll('.touch-controls [data-action], #touchHoldBtn').forEach(button=>{button.disabled=phase!=='running'||(button.dataset.action==='hold'&&!player.canHold);});
  $('touchHoldState').textContent=phase==='running'&&!player.canHold?'待落子':'交換';
  $('cpuSent').textContent=cpuSent;$('cpuLines').textContent=cpu.stats.lines;$('cancelledValue').textContent=cancelled;$('sentBattleValue').textContent=sent;
  $('incomingValue').innerHTML=total+'<small>行</small>';$('incomingFill').style.height=Math.min(100,total/12*100)+'%';$('pressureFill').style.width=Math.min(100,total/12*100)+'%';$('pressureTitle').closest('section').classList.toggle('danger',total>0);
  $('pressureText').textContent=!isVersus()?'沒有壓力。把這一手做到順。':total?(incomingPlayer[0].at>elapsed?`${((incomingPlayer[0].at-elapsed)/1000).toFixed(1)} 秒後，於下一次落子入場`:'下一次落子入場。消行攻擊可先抵消。'):'目前安全。準備你的下一手。';
  if(mode==='ranked')$('arenaCaption').textContent=t('ranked.liveCaption',{sent:cpuSent,incoming:total});
  else if(isVersus()&&phase!=='ready')$('arenaCaption').textContent=`CPU 淨送出 ${cpuSent} 行 · 待抵消 ${total} 行`+(total?(incomingPlayer[0].at>elapsed?` · ${((incomingPlayer[0].at-elapsed)/1000).toFixed(1)} 秒後抵達`:' · 下次落子入場'):' · 找好下一個反擊機會');
  if(mode==='drill')$('arenaCaption').textContent=drillAltered?'已交換方塊；按 R 重擺洞型後，再練標準 T-Spin。':`${keyLabels('cw')} 順轉一次，再按 ${keyName(settings.keys.hard)} 硬降。`;
  if(holdGuide)$('arenaCaption').textContent='暫存引導中 · 不會自動下落 · 先交換，再落子解鎖';
  $('drillWins').textContent=String(drillWins).padStart(2,'0');$('pauseBtn').disabled=!['running','paused'].includes(phase);
  $('cpuIdle').textContent=isVersus()?(phase==='paused'?'PAUSED':phase==='ended'?'FINISHED':phase==='running'?'LIVE':'READY'):'SOLO';
  updateHoldGuide();updatePartyUI();syncAudio();updateAudioStatus();
  const layoutKey=`${mode}:${phase}:${Boolean(holdGuide)}`;
  if(layoutKey!==lastLayoutKey){lastLayoutKey=layoutKey;scheduleBoardFit();}
}

function updateSettings(){
  for(const id of ['das','arr','soft','lock']){$(id+'Input').value=settings[id];$(id+'Output').textContent=settings[id]+' ms';}
  $('dasSummary').textContent=settings.das;$('arrSummary').textContent=settings.arr;$('lockSummary').textContent=settings.lock;
  $('reduceMotion').checked=settings.reduce;document.body.classList.toggle('reduced',settings.reduce);
  updateAudioControls();updateViewControls();
  if(player){player.settings.lockDelay=mode==='ranked'?500:settings.lock;cpu.settings.lockDelay=mode==='ranked'?500:settings.lock;}
  document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('selected',Object.entries(PRESETS[b.dataset.preset]).every(([k,v])=>settings[k]===v)));
  $('keyBindings').innerHTML=Object.entries(ACTION_LABELS).map(([key,label])=>`<div><span>${label}</span><button data-bind="${key}" aria-label="重新設定${label}按鍵，目前 ${keyName(settings.keys[key])}">${keyName(settings.keys[key])}</button></div>`).join('');
  $('keyBindings').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{pendingBinding=b.dataset.bind;$('keyBindings').querySelectorAll('button').forEach(x=>x.classList.remove('waiting'));b.classList.add('waiting');b.textContent='按新按鍵';$('bindingHint').textContent='按下新按鍵，或按 Esc 取消。';}));
  const k=settings.keys;
  const cw=keyLabels('cw'),hold=keyLabels('hold'),layout=keyboardLayout();
  const layoutName={classic:'經典方向鍵',wasd:'WASD',custom:'自訂鍵位'}[layout];
  $('keyPresetLabel').textContent=layoutName;$('keyLayoutState').textContent=layoutName;
  document.querySelectorAll('[data-key-preset]').forEach(button=>{const chosen=button.dataset.keyPreset===layout;button.classList.toggle('selected',chosen);button.setAttribute('aria-pressed',String(chosen));});
  const tile=(action,label)=>`<div class="key-tile"><kbd>${keyName(k[action])}</kbd><small>${label}</small></div>`;
  const spinKeys=tile('ccw','逆轉')+tile('cw','順轉')+tile('hold','暫存交換');
  const moveKeys=tile('left','向左')+tile('soft','軟降')+tile('right','向右');
  $('keyboardHands').innerHTML=`<div class="keyboard-hand"><span>${layout==='classic'?'左手 · 旋轉 / 暫存':'旋轉 / 暫存'}</span><div>${spinKeys}</div></div><div class="keyboard-hand"><span>${layout==='classic'?'右手 · 移動 / 軟降':layout==='wasd'?'A / S / D · 移動':'移動 / 軟降'}</span><div>${moveKeys}</div></div><div class="keyboard-finish"><span>擺好再固定</span><kbd>${keyName(k.hard)}</kbd><small>硬降 · 立即固定</small></div>`;
  $('keyboardAliases').textContent=`順轉 ${cw} · 暫存交換 ${hold} · 暫停 ${keyName(k.pause)}。軟降到底仍可轉；硬降後就固定。`;
  document.querySelector('.controls-footer>div').innerHTML=`<kbd>${keyName(k.left)}</kbd><kbd>${keyName(k.right)}</kbd><span>移動</span><kbd>${keyName(k.soft)}</kbd><span>軟降</span><kbd>${keyName(k.ccw)}</kbd><kbd>${cw}</kbd><span>旋轉</span><kbd>${keyName(k.hard)}</kbd><span>立即固定</span><kbd>${hold}</kbd><span>暫存交換</span><kbd>${keyName(k.pause)}</kbd><span>暫停</span>`;
  $('holdKey').textContent=hold.replaceAll('SHIFT','⇧');
  $('playerCanvas').setAttribute('aria-label',`你的方塊棋盤。${keyName(k.left)}與${keyName(k.right)}移動，${keyName(k.soft)}軟降，${keyName(k.ccw)}逆時針，${cw}順時針，${keyName(k.hard)}硬降並立即固定，${hold}暫存交換，${keyName(k.pause)}暫停。`);
  document.querySelectorAll('.touch-controls [data-action], #touchHoldBtn').forEach(button=>{const action=button.dataset.action,detail=action==='hard'?'，立即固定方塊':action==='soft'?'，落地後仍可旋轉':action==='hold'?'，每顆落子只能一次':'';button.setAttribute('aria-label',`${ACTION_LABELS[action]}${detail}。鍵盤 ${keyLabels(action)}。`);button.title=`${ACTION_LABELS[action]} · ${keyLabels(action)}`;});
  MODES.drill.rule=`① ${cw} 順時針旋轉<br>② ${keyName(k.hard)} 硬降，完成雙消`;
  if(mode==='drill')$('modeRule').innerHTML=MODES.drill.rule;
  $('helpDropText').textContent=`${keyName(k.soft)} 會加快下落，接地後還有短暫時間可以旋轉。${keyName(k.hard)} 直接落到底並固定；要轉進洞，先旋轉，再硬降。`;
  $('helpSpinText').textContent=`T-Spin 道場已排好局面。按 ${cw} 順時針旋轉，再按 ${keyName(k.hard)} 固定，體驗轉進洞並消兩行。道場不會自動下落；交換方塊後請按 R 重擺，該次不計成功。`;
  $('helpHoldText').textContent=`按 ${hold}，或點棋盤左側的「暫存交換」。第一次存入目前方塊並取出 NEXT；之後與 HOLD 內的方塊交換。每顆落子只能一次，固定後才會解鎖；不能連按把下一顆一直洗掉。`;
  if(phase==='paused')$('overlayHint').textContent=`按 ${keyName(k.pause)} 或按鈕繼續`;
  if(mode==='drill'&&phase==='ended'&&lastDrillResult==='drillFail')$('overlayText').innerHTML=`先按 ${cw} 順轉一次，<br>確認卡進洞裡，再按 ${keyName(k.hard)} 硬降。`;
  if(player)updateUI();
  storeSettings();
}
function openDialog(id){if(phase==='running')pause();clearInputs();$(id).showModal();}
function closeDialog(id){$(id).close();pendingBinding=null;updateSettings();}

document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>selectMode(b.dataset.mode)));
document.querySelectorAll('[data-lobby-mode]').forEach(button=>button.addEventListener('click',()=>{
  const next=button.dataset.lobbyMode;
  if(selectMode(next))start();
}));
$('lobbyRoomLink').addEventListener('click',event=>{
  if(ranked.matchId||ranked.queued){event.preventDefault();inform('請先完成或退出目前排位，再進入多人好友房。');}
});

$('roomModeLink').addEventListener('click',event=>{
  if(ranked.matchId||ranked.queued){event.preventDefault();inform('請先完成或退出目前排位，再進入多人好友房。');return;}
  if(phase==='running'&&!confirm('離開目前這一局，前往多人好友房？'))event.preventDefault();
});
$('startBtn').addEventListener('click',()=>start(false));$('secondaryBtn').addEventListener('click',()=>{if(mode==='ranked')void leaveRanked();else start(true);});
$('pauseBtn').addEventListener('click',togglePause);
$('sidebarToggle').addEventListener('click',event=>{
  clearInputs();
  sidebarExpanded=!sidebarExpanded;
  try { localStorage.setItem(SIDEBAR_STORAGE_KEY,sidebarExpanded?'expanded':'collapsed'); } catch {}
  responsiveControls();
  // Pointer users can keep playing immediately; keyboard users retain the
  // disclosure button's focus so Space and Enter keep their native behavior.
  if(event.detail>0&&phase==='running')$('playerCanvas').focus({preventScroll:true});
});
$('retryBtn').addEventListener('click',()=>{if(mode==='ranked'){if(ranked.matchId)showLeaveDialog('ranked');else void startRanked();return;}if(ticketBusy)return;if(phase==='running'||phase==='paused'||phase==='ended'){phase='ready';start(true);}else start(true);});
$('undoBtn').addEventListener('click',undo);
$('drillShortcut').addEventListener('click',()=>{if(selectMode('drill'))start();});
$('holdGuideBtn').addEventListener('click',startHoldGuide);$('helpHoldGuideBtn').addEventListener('click',startHoldGuide);
$('finishHoldGuide').addEventListener('click',finishHoldGuide);
for(const button of ['settingsBtn','tuneBtn'])$(button).addEventListener('click',()=>openDialog('settingsDialog'));
$('keySettingsBtn').addEventListener('click',()=>{openDialog('settingsDialog');$('keyboardPresetSection').scrollIntoView({block:'center'});});
$('helpBtn').addEventListener('click',()=>openDialog('helpDialog'));$('visionBtn').addEventListener('click',()=>openDialog('visionDialog'));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d.id);}});d.addEventListener('close',()=>{pendingBinding=null;clearInputs();if(d.id==='audioDialog')resetAudioPreview();});});
$('soundBtn').addEventListener('click',()=>{openDialog('audioDialog');updateAudioControls();updateAudioStatus();});
$('audioEnabled').addEventListener('change',()=>{settings.sound=$('audioEnabled').checked;if(!settings.sound)resetAudioPreview();updateAudioControls();initAudio();storeSettings();});
for(const id of ['musicVolume','sfxVolume'])$(id).addEventListener('input',()=>{settings[id]=Number($(id).value);updateAudioControls();initAudio();storeSettings();});
$('testMusic').addEventListener('click',()=>{audioPreview=!audioPreview;settings.sound=true;updateAudioControls();initAudio();storeSettings();});
$('testSfx').addEventListener('click',async()=>{
  const request=++audioPreviewId;audioPreview=false;settings.sound=true;audioSfxPreviewUntil=performance.now()+1800;
  updateAudioControls();storeSettings();await sound.unlock();
  for(let attempt=0;attempt<12&&request===audioPreviewId&&$('audioDialog').open;attempt++){
    if(sound.play('item'))break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
});
document.querySelectorAll('[data-item]').forEach(button=>button.addEventListener('click',event=>{usePlayerItem(button.dataset.item);if(event.detail>0&&phase==='running')$('playerCanvas').focus({preventScroll:true});}));
document.querySelectorAll('[data-opponent-view]').forEach(button=>button.addEventListener('click',()=>setOpponentView(button.dataset.opponentView)));
$('boardSizeBtn').addEventListener('click',event=>{settings.boardSize=settings.boardSize==='large'?'standard':'large';updateViewControls();storeSettings();scheduleBoardFit();if(event.detail>0&&phase==='running')$('playerCanvas').focus({preventScroll:true});});
$('fullscreenBtn').addEventListener('click',async()=>{
  clearInputs();
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{inform('目前環境未開放全螢幕；大棋盤仍會依視窗自動調整。');}
  updateViewControls();scheduleBoardFit();
});
document.addEventListener('fullscreenchange',()=>{updateViewControls();scheduleBoardFit();});
$('difficulty').addEventListener('change',()=>{if(ticketBusy){$('difficulty').value=String(bot.pps);return;}if(mode==='ranked')return;if(phase==='running'||phase==='paused'){phase='ready';prepare();refreshMode();const m=MODES[mode];showOverlay({kicker:m.kicker,title:m.headline,text:'已切換 CPU 節奏。<br>新局會套用新的速度。',button:m.start,hint:m.hint});}else if(bot)bot.pps=Number($('difficulty').value);updateUI();});
for(const id of ['das','arr','soft','lock'])$(id+'Input').addEventListener('input',()=>{settings[id]=Number($(id+'Input').value);clearInputs();updateSettings();});
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{Object.assign(settings,PRESETS[b.dataset.preset]);clearInputs();updateSettings();}));
document.querySelectorAll('[data-key-preset]').forEach(button=>button.addEventListener('click',()=>{settings.keys={...KEY_LAYOUTS[button.dataset.keyPreset]};pendingBinding=null;clearInputs();updateSettings();$('bindingHint').textContent='鍵位已更新。也可以展開自訂，逐鍵調整。';}));
$('reduceMotion').addEventListener('change',()=>{settings.reduce=$('reduceMotion').checked;updateSettings();});
$('resetSettings').addEventListener('click',()=>{settings=structuredClone(DEFAULTS);pendingBinding=null;updateSettings();inform('已恢復試作預設手感。');});

function actionFor(code){const exact=Object.entries(settings.keys).find(([,v])=>v===code);if(exact)return exact[0];if(code==='ArrowUp')return 'cw';if(code==='ShiftLeft'||code==='ShiftRight')return 'hold';return null;}
document.addEventListener('keydown',e=>{
  if(pendingBinding){
    e.preventDefault();e.stopPropagation();
    if(e.code==='Escape'){pendingBinding=null;updateSettings();return;}
    if(e.repeat)return;
    if(['Tab','MetaLeft','MetaRight','ControlLeft','ControlRight','AltLeft','AltRight','KeyU','KeyR'].includes(e.code)){ $('bindingHint').textContent='這個按鍵保留給系統、撤銷或重試，請選另一個。';return;}
    const conflict=Object.entries(settings.keys).find(([k,v])=>k!==pendingBinding&&v===e.code);
    if(conflict){$('bindingHint').textContent='這個按鍵已經有功能，請選另一個。';return;}
    settings.keys[pendingBinding]=e.code;pendingBinding=null;updateSettings();$('bindingHint').textContent='已更新。關閉設定後就能試手感。';return;
  }
  if(document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  // Keyboard activation on a focused button must activate that button, not drop
  // a piece behind it. The board itself keeps the chosen gameplay bindings.
  if(e.target.closest?.('button')&&['Space','Enter'].includes(e.code))return;
  if(e.code==='KeyU'){e.preventDefault();if(!e.repeat)undo();return;}
  if(e.code==='KeyR'){e.preventDefault();if(!e.repeat&&mode==='drill'){phase='ready';start(true);}return;}
  const action=actionFor(e.code);
  if(!action&&mode==='party'&&ITEM_KEYS[e.code]){e.preventDefault();if(!e.repeat)usePlayerItem(ITEM_KEYS[e.code]);return;}
  if(action==='pause'){e.preventDefault();if(!e.repeat)togglePause();return;}
  if(e.code==='Escape'){if(phase==='running'){e.preventDefault();pause();}return;}
  if(!action||phase!=='running')return;
  e.preventDefault();if(e.repeat||heldCodes.has(e.code))return;heldCodes.set(e.code,action);repeater.press(action,{minDas:190});
});
document.addEventListener('keyup',e=>{const action=heldCodes.get(e.code);if(action){heldCodes.delete(e.code);if(![...heldCodes.values()].includes(action))repeater.release(action);}});
window.addEventListener('blur',()=>{clearInputs();if(phase==='running')pause();if(audioPreview)resetAudioPreview();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInputs();if(phase==='running')pause();resetAudioPreview();}syncAudio();});
document.querySelectorAll('[data-action]').forEach(button=>{
  const action=button.dataset.action;
  const repeating=['left','right','soft'].includes(action);
  button.addEventListener('pointerdown',e=>{if(button.disabled||phase!=='running')return;e.preventDefault();initAudio();button.setPointerCapture(e.pointerId);button.classList.add('pressed');if(repeating)repeater.press(action,{minDas:260});else perform(action);});
  const up=()=>{button.classList.remove('pressed');if(repeating)repeater.release(action);};
  button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
  button.addEventListener('click',e=>{if(e.detail===0&&!button.disabled&&phase==='running'){initAudio();perform(action);updateUI();draw();}});
  button.addEventListener('contextmenu',e=>e.preventDefault());
});
const difficultyHome=$('difficultyLabel').parentElement;
function responsiveControls(){
  const desktop=matchMedia('(min-width:901px)').matches;
  const expanded=desktop&&sidebarExpanded;
  $('sidebarToggle').hidden=!desktop;
  $('sidebarToggle').setAttribute('aria-expanded',String(expanded));
  $('sidebarToggleLabel').textContent=expanded?'收合說明':'模式說明';
  $('sidebarToggle').title=expanded?'收起左側模式說明':'展開左側模式說明與練習入口';
  $('modeSidebar').hidden=!expanded;
  document.querySelector('.workspace').classList.toggle('left-collapsed',!expanded);
  if(!expanded)document.querySelector('.settings-modal .presets').after($('difficultyLabel'));
  else difficultyHome.append($('difficultyLabel'));
}
function updateViewControls(){
  const large=settings.boardSize==='large';
  $('boardSizeBtn').textContent=large?'大棋盤':'標準棋盤';
  $('boardSizeBtn').setAttribute('aria-pressed',String(large));
  $('boardSizeBtn').setAttribute('aria-label',large?'目前大棋盤，切換為標準棋盤':'目前標準棋盤，切換為大棋盤');
  $('fullscreenBtn').hidden=!document.fullscreenEnabled;
  $('fullscreenBtn').setAttribute('aria-label',document.fullscreenElement?'離開全螢幕':'進入全螢幕');
  $('fullscreenBtn').title=document.fullscreenElement?'離開全螢幕':'全螢幕';
  scheduleBoardFit();
}
function scheduleBoardFit(){if(boardFitPending)return;boardFitPending=true;requestAnimationFrame(()=>{boardFitPending=false;fitBoard();});}
function fitBoard(){
  const wrap=document.querySelector('.playfield-wrap'),arena=document.querySelector('.arena-card');
  const css=getComputedStyle(wrap),n=value=>parseFloat(value)||0;
  const railWidths=[...wrap.querySelectorAll('.piece-rail')].reduce((sum,rail)=>sum+rail.getBoundingClientRect().width,0);
  const maxWidth=wrap.clientWidth-n(css.paddingLeft)-n(css.paddingRight)-railWidths-2*n(css.columnGap);
  const boxHeight=selector=>{const element=arena.querySelector(selector);if(!element||element.hidden||getComputedStyle(element).display==='none')return 0;const style=getComputedStyle(element);return element.getBoundingClientRect().height+n(style.marginTop)+n(style.marginBottom);};
  const narrow=matchMedia('(max-width:760px)').matches;
  const touch=narrow||matchMedia('(any-pointer:coarse)').matches;
  const top=wrap.getBoundingClientRect().top+window.scrollY+n(css.paddingTop);
  const below=boxHeight('.arena-metrics')+boxHeight('.arena-caption')+boxHeight('.touch-controls')+boxHeight('.hold-guide')+n(getComputedStyle(arena).paddingBottom)+14;
  // Browser chrome can resize the visible area without changing the layout viewport.
  // Keep the complete touch deck in view; do not reserve a 400px board on short tablets.
  const visibleHeight=window.visualViewport?.scale===1?window.visualViewport.height:window.innerHeight;
  const viewport=visibleHeight-top-below;
  const minimum=touch?(holdGuide?180:200):holdGuide?240:400;
  const full=Math.min(900,Math.max(minimum,viewport),Math.max(180,maxWidth*2));
  const height=Math.floor(full*(settings.boardSize==='standard'?.82:1));
  const value=height+'px';
  if(arena.style.getPropertyValue('--board-h')!==value)arena.style.setProperty('--board-h',value);
  draw();
}
window.addEventListener('resize',()=>{responsiveControls();scheduleBoardFit();});
window.visualViewport?.addEventListener('resize',scheduleBoardFit);
if(globalThis.ResizeObserver){const observer=new ResizeObserver(scheduleBoardFit);observer.observe(document.querySelector('.arena-card'));observer.observe(document.querySelector('.topbar'));}


function frame(now){
  gamepad.poll();
  const rawDelta=lastFrame?Math.max(0,now-lastFrame):0;lastFrame=now;
  if(phase==='running'){
    // Input repeats once per visible frame; do not replay a burst of held moves after a lag spike.
    repeater.step(Math.min(rawDelta,32),{maxHorizontalRepeats:1});
    elapsed+=rawDelta;
    if(mode!=='ranked'&&isVersus()&&elapsed>=120000)end(sent===cpuSent?'tie':sent>cpuSent?'win':'loss');
    else{accumulator+=Math.min(100,rawDelta);while(accumulator>=FIXED_DT){step(FIXED_DT);accumulator-=FIXED_DT;if(phase!=='running'){accumulator=0;break;}}}
  }else accumulator=0;
  if(now>calloutUntil)$('moveCallout').classList.remove('show');if(now>toastUntil)$('globalToast').classList.remove('show');
  draw();if(now-lastUi>70){updateUI();lastUi=now;}requestAnimationFrame(frame);
}
document.querySelector('.arena-card').append(document.querySelector('.touch-controls'));
initLocalization();applyAppearance();
memberUI=initMemberUI({beforeOpen:()=>{if(phase==='running')pause();clearInputs();},afterClose:()=>{clearInputs();scheduleBoardFit();},onRanked:()=>selectMode('ranked')});
subscribeLocale(()=>{updateSettings();scheduleBoardFit();});
responsiveControls();applyMode(new URLSearchParams(location.search).get('mode')==='ranked'?'ranked':'duel');setOpponentView(opponentView);updateSettings();requestAnimationFrame(frame);
