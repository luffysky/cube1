import {WIDTH,HEIGHT,LEVELS,makeLevel,walk,flip,fall} from './engine.mjs';
let g=makeLevel(0),accumulator=0,last=performance.now();
const $=id=>document.getElementById(id),board=$('board');
function draw(){
 const scene=LEVELS[g.index];board.replaceChildren();
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  const cell=document.createElement('div');cell.className='cell';
  if(scene.walls.some(([a,b])=>a===x&&b===y)){cell.classList.add('wall');cell.textContent='▧';}
  if(scene.goal[0]===x&&scene.goal[1]===y){cell.classList.add('goal');cell.textContent='✦';}
  if(g.x===x&&g.y===y){cell.classList.add('player');cell.textContent='◆';}
  board.append(cell);
 }
 $('levelName').textContent=scene.name;$('gravity').textContent=g.gravity>0?'↓':'↑';
 $('moves').textContent=g.moves;$('next').disabled=!g.won||g.index===LEVELS.length-1;
 $('pause').textContent=g.paused?'繼續':'暫停';
 $('status').textContent=g.won?'順利到達目標！':g.paused?'暫停中。':'紫色不能通過，切換重力繞過障礙。';
}
function action(fn){if(fn()){draw();}}
$('left').onclick=()=>action(()=>walk(g,-1));
$('right').onclick=()=>action(()=>walk(g,1));
$('flip').onclick=()=>action(()=>flip(g));
$('pause').onclick=()=>{g.paused=!g.paused;last=performance.now();draw();};
$('reset').onclick=()=>{g=makeLevel(g.index);accumulator=0;draw();};
$('next').onclick=()=>{if(g.won&&g.index<LEVELS.length-1){g=makeLevel(g.index+1);accumulator=0;draw();}};
window.addEventListener('keydown',e=>{
 if(['ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
 if(e.repeat)return;
 if(e.key==='ArrowLeft')walk(g,-1);
 if(e.key==='ArrowRight')walk(g,1);
 if(e.key===' ')flip(g);
 if(e.key.toLowerCase()==='r'){g=makeLevel(g.index);}
 draw();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){g.paused=true;draw();}last=performance.now();});
function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 if(!g.paused&&!g.won){
  accumulator+=dt;
  if(accumulator>=.16){accumulator-=.16;if(fall(g))draw();}
 }else accumulator=0;
 requestAnimationFrame(frame);
}
draw();requestAnimationFrame(frame);
