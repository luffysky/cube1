import {W,H,DURATION,makeGame,start,move,togglePause,tick} from './engine.mjs';

const canvas=document.querySelector('#arena'),ctx=canvas.getContext('2d');
const timer=document.querySelector('#timer'),score=document.querySelector('#score'),
  health=document.querySelector('#health'),status=document.querySelector('#status'),
  startButton=document.querySelector('#start'),pauseButton=document.querySelector('#pause'),
  best=document.querySelector('#best');
const game=makeGame();
const keys=new Set();
const bestKey='snowrealm.zero-dodge.best.v1';
let bestScore=0,prev=performance.now(),drag=false;
try{bestScore=Math.max(0,Number(localStorage.getItem(bestKey))||0);}catch{}
best.textContent=bestScore.toLocaleString('zh-TW');
function updateHUD(){
  timer.textContent=String(Math.ceil(DURATION-game.elapsed)).padStart(2,'0');
  score.textContent=game.score.toLocaleString('zh-TW');
  health.textContent='♥'.repeat(game.life)+'♡'.repeat(3-game.life);
  const text={ready:'準備開局：活過 60 秒！',playing:'避開紅色隕石，撐到倒數歸零。',paused:'遊戲已暫停',won:'挑戰成功！你穿越了零界。',lost:'被彈幕擊中，挑戰失敗。'};
  status.textContent=text[game.phase];
  startButton.textContent=game.phase==='ready'?'開始挑戰':'重新挑戰';
  pauseButton.disabled=!['playing','paused'].includes(game.phase);
  pauseButton.textContent=game.phase==='paused'?'繼續':'暫停';
}
function begin(){start(game);prev=performance.now();updateHUD();}
startButton.addEventListener('click',begin);
pauseButton.addEventListener('click',()=>{togglePause(game);prev=performance.now();updateHUD();});
document.querySelector('#mobilePause').addEventListener('click',()=>{togglePause(game);prev=performance.now();updateHUD();});
function locate(event){
  const box=canvas.getBoundingClientRect();
  move(game,(event.clientX-box.left)/box.width*W,(event.clientY-box.top)/box.height*H);
}
canvas.addEventListener('pointerdown',event=>{
  if(game.phase!=='playing')return;drag=true;
  canvas.setPointerCapture?.(event.pointerId);locate(event);
});
canvas.addEventListener('pointermove',event=>{if(drag&&game.phase==='playing')locate(event);});
canvas.addEventListener('pointerup',()=>{drag=false;});
canvas.addEventListener('pointercancel',()=>{drag=false;});
window.addEventListener('keydown',event=>{
  const key=event.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))event.preventDefault();
  keys.add(key);
  if(key===' '&&!event.repeat){
    if(game.phase==='ready'||game.phase==='won'||game.phase==='lost')begin();
    else {togglePause(game);prev=performance.now();updateHUD();}
  }
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(game.phase==='playing')togglePause(game);updateHUD();});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&game.phase==='playing'){togglePause(game);updateHUD();}
  prev=performance.now();
});
function paint(){
  const t=game.elapsed;
  ctx.clearRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#091123');bg.addColorStop(1,'#150d32');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(91,135,216,.16)';ctx.lineWidth=1;
  for(let x=0;x<=W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<=H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.save();ctx.translate(W/2,H/2);ctx.rotate(t*.06);
  for(let i=0;i<3;i++){
    ctx.beginPath();ctx.arc(0,0,110+i*92,0,Math.PI*2);
    ctx.strokeStyle='rgba(80,190,255,'+(0.12+i*.03)+')';ctx.lineWidth=2;ctx.stroke();
  }ctx.restore();
  for(const ball of game.comets){
    ctx.fillStyle='rgba(255,73,125,.18)';ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r+12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff547d';ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffc0c7';ctx.beginPath();ctx.arc(ball.x-3,ball.y-3,ball.r*.35,0,Math.PI*2);ctx.fill();
  }
  if(game.phase!=='lost'&&!(game.invulnerable>0&&Math.floor(t*16)%2)){
    const p=game.player;
    ctx.shadowBlur=25;ctx.shadowColor='#36e4fa';
    ctx.fillStyle='#6eefff';ctx.beginPath();ctx.moveTo(p.x,p.y-18);ctx.lineTo(p.x+14,p.y+12);ctx.lineTo(p.x,p.y+7);ctx.lineTo(p.x-14,p.y+12);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  }
  if(game.phase!=='playing'){
    ctx.fillStyle='rgba(3,8,20,.65)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 40px system-ui';
    ctx.fillText(({ready:'零界閃避',paused:'已暫停',won:'生存成功！',lost:'挑戰失敗'})[game.phase],W/2,H*.46);
    ctx.font='20px system-ui';ctx.fillStyle='#c2d8ff';
    ctx.fillText(game.phase==='ready'?'躲開隕石，60 秒後獲勝':'按上方按鈕繼續或重新挑戰',W/2,H*.53);
  }
}
function loop(now){
  const dt=Math.min(.05,(now-prev)/1000);prev=now;
  if(game.phase==='playing'){
    tick(game,dt,{
      x:Number(keys.has('arrowright')||keys.has('d'))-Number(keys.has('arrowleft')||keys.has('a')),
      y:Number(keys.has('arrowdown')||keys.has('s'))-Number(keys.has('arrowup')||keys.has('w'))
    });
    if((game.phase==='won'||game.phase==='lost')&&game.score>bestScore){
      bestScore=game.score;best.textContent=bestScore.toLocaleString('zh-TW');
      try{localStorage.setItem(bestKey,String(bestScore));}catch{}
    }
    updateHUD();
  }
  paint();requestAnimationFrame(loop);
}
updateHUD();requestAnimationFrame(loop);
