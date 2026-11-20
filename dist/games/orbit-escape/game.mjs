import {SEGMENTS,STAGES,makeStage,turnAvatar,rotateRing,escape} from './engine.mjs';
let g=makeStage(0);
const svg=document.querySelector('#rings'),NS='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);
const add=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));svg.append(n);return n;};
const pos=(sector,r)=>{const angle=(sector/SEGMENTS)*Math.PI*2-Math.PI/2;return [320+Math.cos(angle)*r,320+Math.sin(angle)*r];};
function draw(){
 svg.replaceChildren();
 add('circle',{cx:320,cy:320,r:265,fill:'#102b40',stroke:'#345f83','stroke-width':3});
 for(let i=2;i>=0;i--){
   const radius=75+i*85,gate=g.gates[i];
   const parts=32,halfGap=Math.PI/SEGMENTS*.45;
   const start=gate*Math.PI*2/SEGMENTS-Math.PI/2;
   const p1=pos(gate,radius);
   const d=[];
   for(let n=0;n<=120;n++){
     const angle=start+halfGap+(Math.PI*2-2*halfGap)*n/120;
     const x=320+radius*Math.cos(angle),y=320+radius*Math.sin(angle);
     d.push((n?'L':'M')+x.toFixed(2)+','+y.toFixed(2));
   }
   const path=add('path',{d:d.join(' '),fill:'none',stroke:i<g.ring?'#36576e':'#6de6ed','stroke-width':23,'stroke-linecap':'round'});
   add('circle',{cx:p1[0],cy:p1[1],r:7,fill:'#ffe09c'});
 }
 const r=g.ring>=3?300:38+g.ring*85;
 const [x,y]=pos(g.sector,r);
 add('circle',{cx:x,cy:y,r:17,fill:'#ffcf73',stroke:'#fff0bc','stroke-width':3});
 add('circle',{cx:320,cy:320,r:27,fill:'#183f4d',stroke:'#4dd9ce','stroke-width':2});
 $('stage').textContent=STAGES[g.index].name;
 $('ring').textContent=g.won?'完成':g.ring+1;$('turns').textContent=g.turns;
 $('status').textContent=g.won?'成功逃出環域！可以挑戰下一關。':
   g.sector===g.gates[g.ring]?'方向吻合！按「穿過當前缺口」。':'金色點是目前位置，找到對應的缺口。';
 $('next').disabled=!g.won||g.index>=STAGES.length-1;
}
function rotate(delta){rotateRing(g,g.ring,delta);draw();}
document.querySelectorAll('[data-avatar]').forEach(b=>b.addEventListener('click',()=>{turnAvatar(g,Number(b.dataset.avatar));draw();}));
document.querySelectorAll('[data-gate]').forEach(b=>b.addEventListener('click',()=>rotate(Number(b.dataset.gate))));
$('escape').addEventListener('click',()=>{escape(g);draw();});
$('reset').addEventListener('click',()=>{g=makeStage(g.index);draw();});
$('next').addEventListener('click',()=>{if(g.won&&g.index<STAGES.length-1){g=makeStage(g.index+1);draw();}});
window.addEventListener('keydown',e=>{
 if(['ArrowLeft','ArrowRight',' ','q','Q','e','E'].includes(e.key))e.preventDefault();
 if(e.key==='ArrowLeft')turnAvatar(g,-1);
 if(e.key==='ArrowRight')turnAvatar(g,1);
 if(e.key.toLowerCase()==='q')rotateRing(g,g.ring,-1);
 if(e.key.toLowerCase()==='e')rotateRing(g,g.ring,1);
 if(e.key===' ')escape(g);draw();
});
draw();
