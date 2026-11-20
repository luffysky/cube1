import {NODES,neighbors,newMatch,canCapture,playTurn,counts} from './engine.mjs';
let game=newMatch();
const $=id=>document.getElementById(id),svg=$('map'),NS='http://www.w3.org/2000/svg';
const pos=id=>[120+id%3*180,120+Math.floor(id/3)*180];
const add=(tag,attrs,text='')=>{
 const el=document.createElementNS(NS,tag);
 for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));
 if(text)el.textContent=text;svg.append(el);return el;
};
function render(){
 svg.replaceChildren();
 for(let id=0;id<NODES;id++)for(const n of neighbors(id).filter(x=>x>id)){
  const [x,y]=pos(id),[tx,ty]=pos(n);
  add('line',{x1:x,y1:y,x2:tx,y2:ty,stroke:'#53607b','stroke-width':8,'stroke-linecap':'round'});
 }
 for(let id=0;id<NODES;id++){
  const [x,y]=pos(id),owner=game.owners[id],legal=canCapture(game,1,id);
  const cell=add('g',{role:'button',tabindex:'0','aria-label':'佔領節點 '+(id+1)});
  const circle=document.createElementNS(NS,'circle');
  for(const [key,value] of Object.entries({cx:x,cy:y,r:56,fill:owner===1?'#3bc6c8':owner===2?'#e36b79':'#364a60',
    stroke:legal?'#ffe3a8':'#79839a','stroke-width':legal?7:3}))circle.setAttribute(key,String(value));
  cell.append(circle);
  const text=document.createElementNS(NS,'text');
  for(const [key,value] of Object.entries({x,y:y+10,'font-size':31,'text-anchor':'middle',fill:'#ffffff'}))text.setAttribute(key,String(value));
  text.textContent=String(id+1);cell.append(text);svg.append(cell);
  cell.addEventListener('click',()=>attempt(id));
  cell.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();attempt(id);}});
 }
 const c=counts(game);
 $('round').textContent=game.round;$('energy').textContent=game.energy[1];
 $('aiEnergy').textContent=game.energy[2];$('count').textContent=c.player+' / '+c.ai;
 $('status').textContent=game.phase==='won'?'你已奪取六個據點，勝利！':
  game.phase==='lost'?'AI 控制了更多領地，這局失敗。':
  game.phase==='draw'?'勢均力敵，平手結束。':game.last+'。點亮的節點可以佔領。';
}
function attempt(id){if(playTurn(game,id))render();else if(game.phase==='playing'){$('status').textContent='此處不相鄰、已佔領或能量不足。';}}
$('restart').addEventListener('click',()=>{game=newMatch();render();});
render();
