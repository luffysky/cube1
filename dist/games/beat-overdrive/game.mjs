import {LANES,BEAT,BPM,NOTES,SONG_SECONDS,makeState,start,advance,tap} from './engine.mjs';
const state=makeState(),stage=document.querySelector('#stage');
const $=id=>document.getElementById(id);let audio=null,last=performance.now(),muted=false;
const elements=NOTES.map(note=>{
 const el=document.createElement('div');el.className='note';
 el.style.left=(note.lane*25+2)+'%';stage.append(el);return el;
});
async function unlockAudio(){
 if(muted)return;
 const AudioContextImpl=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextImpl)return;
 try{audio??=new AudioContextImpl();await audio.resume();}catch{audio=null;}
}
function tone(freq,time,duration=.07){
 if(!audio||muted)return;
 try{
  const osc=audio.createOscillator(),gain=audio.createGain();
  osc.type='triangle';osc.frequency.setValueAtTime(freq,time);
  gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.085,time+.005);
  gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  osc.connect(gain);gain.connect(audio.destination);
  osc.start(time);osc.stop(time+duration+.01);
 }catch{}
}
let lastBeat=-1;
function hit(lane){
 if(!state.active)return;
 const success=tap(state,lane,state.elapsed);
 if(success)tone(540+lane*105,audio?.currentTime??0,.12);
 $('status').textContent=state.judgement;
}
for(const b of document.querySelectorAll('[data-lane]'))b.addEventListener('pointerdown',()=>hit(Number(b.dataset.lane)));
window.addEventListener('keydown',e=>{
 if(e.repeat)return;
 const lane=['d','f','j','k'].indexOf(e.key.toLowerCase());
 if(lane!==-1){e.preventDefault();hit(lane);}
});
$('start').addEventListener('click',async()=>{
 await unlockAudio();start(state);state.calibrationMs=Number($('calibrate').value);
 last=performance.now();lastBeat=-1;$('status').textContent='跟住節拍，保持連擊！';
});
$('mute').addEventListener('click',()=>{muted=!muted;$('mute').textContent=muted?'聲音：關':'聲音：開';});
$('calibrate').addEventListener('input',()=>{$('offset').textContent=$('calibrate').value;state.calibrationMs=Number($('calibrate').value);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.active){state.active=false;$('status').textContent='已離開遊戲，請重新開始。';}});
function frame(now){
 const dt=Math.min(.1,(now-last)/1000);last=now;const old=state.elapsed;
 if(state.active){
  advance(state,dt);
  const beat=Math.floor(state.elapsed/BEAT);
  if(beat!==lastBeat){lastBeat=beat;tone(beat%4===0?350:240,audio?.currentTime??0,.06);}
 }
 const judgeY=stage.clientHeight*.82;
 NOTES.forEach((n,i)=>{
  const y=judgeY-(n.at-state.elapsed)*185;
  elements[i].style.top=y+'px';
  elements[i].hidden=y< -30||y>stage.clientHeight||state.hits.includes(i);
 });
 $('time').textContent=Math.max(0,SONG_SECONDS-state.elapsed).toFixed(1);
 $('score').textContent=state.score.toLocaleString('zh-TW');
 $('combo').textContent=state.combo;
 if(state.over&&old!==state.elapsed){$('status').textContent='挑戰結束！本局最高連擊 '+state.bestCombo;$('start').textContent='再玩一次';}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
