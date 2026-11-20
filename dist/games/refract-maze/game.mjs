import {SIZE,LEVELS,makeLevel,trace,rotate,reset,hint} from './engine.mjs';
const svg=document.querySelector('#board'),NS='http://www.w3.org/2000/svg';
let level=makeLevel(0),hintTarget=null;
function add(parent,tag,props={},label=''){
 const el=document.createElementNS(NS,tag);
 for(const [key,value] of Object.entries(props))el.setAttribute(key,String(value));
 if(label)el.textContent=label;
 parent.append(el);return el;
}
const at=n=>n*100+50;
function draw(){
 const s=LEVELS[level.index],beam=trace(level);svg.replaceChildren();
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)
  add(svg,'rect',{x:x*100,y:y*100,width:100,height:100,
    fill:(x+y)%2?'#102844':'#12304d',stroke:'#2e4b65','stroke-width':1});
 add(svg,'polyline',{points:beam.segments.map(p=>p.map(at).join(',')).join(' '),
   fill:'none',stroke:beam.won?'#63ffd4':'#5adcf0','stroke-width':7,'stroke-linejoin':'round'});
 for(const [x,y] of s.walls)
  add(svg,'rect',{x:x*100+22,y:y*100+22,width:56,height:56,rx:7,fill:'#ba4c70'});
 for(const m of level.mirrors){
  const x=m.x,y=m.y,k=m.kind;
  const cell=add(svg,'g',{role:'button',tabindex:'0','aria-label':'旋轉鏡面 第'+(x+1)+'欄 第'+(y+1)+'列'});
  add(cell,'rect',{x:x*100+7,y:y*100+7,width:86,height:86,rx:12,
    fill:hintTarget?.x===x&&hintTarget?.y===y?'#615334':'#19435d',
    stroke:hintTarget?.x===x&&hintTarget?.y===y?'#ffd36e':'#4d9bb4','stroke-width':2});
  add(cell,'line',{x1:x*100+24,y1:y*100+(k==='/'?76:24),
    x2:x*100+76,y2:y*100+(k==='/'?24:76),stroke:'#d1faff',
    'stroke-width':9,'stroke-linecap':'round'});
  cell.addEventListener('click',()=>change(x,y));
  cell.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();change(x,y);}});
 }
 const [sx,sy]=s.source;
 add(svg,'circle',{cx:at(sx),cy:at(sy),r:24,fill:'#4ce6fd'});
 add(svg,'text',{x:at(sx),y:at(sy)+7,'text-anchor':'middle','font-size':20,fill:'#06212d'},'▶');
 add(svg,'circle',{cx:at(s.target[0]),cy:at(s.target[1]),r:24,fill:'#ffce69'});
 add(svg,'circle',{cx:at(s.target[0]),cy:at(s.target[1]),r:10,fill:beam.won?'#4affbd':'#533c10'});
 document.querySelector('#moves').textContent=level.moves;
 document.querySelector('#levelName').textContent=s.name;
 document.querySelector('#next').disabled=!beam.won||level.index>=LEVELS.length-1;
 document.querySelector('#status').textContent=beam.won?'光束成功抵達！'+(level.index===LEVELS.length-1?' 全部三關完成！':' 按下一關繼續。'):
    beam.reason==='blocked'?'光撞上障礙，換個角度。':
    beam.reason==='loop'?'光陷入循環，試著重新調整鏡面。':'光還沒連到接收器，繼續旋轉鏡面。';
 document.querySelectorAll('#levels button').forEach((b,i)=>b.setAttribute('aria-current',String(i===level.index)));
}
function change(x,y){if(rotate(level,x,y)){hintTarget=null;draw();}}
document.querySelector('#hint').addEventListener('click',()=>{
 hintTarget=hint(level);
 draw();
 if(hintTarget)document.querySelector('#status').textContent='金色外框的鏡面需要再轉一次。';
});
document.querySelector('#reset').addEventListener('click',()=>{reset(level);hintTarget=null;draw();});
document.querySelector('#next').addEventListener('click',()=>{
 if(trace(level).won&&level.index<LEVELS.length-1){level=makeLevel(level.index+1);hintTarget=null;draw();}
});
LEVELS.forEach((s,i)=>{
 const b=document.createElement('button');b.className='secondary';b.textContent=String(i+1);
 b.setAttribute('aria-label',s.name);b.addEventListener('click',()=>{level=makeLevel(i);hintTarget=null;draw();});
 document.querySelector('#levels').append(b);
});
draw();