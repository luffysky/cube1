// Territory Conquest: turn-based deterministic 3x3 graph strategy vs local AI.
export const NODES=9,MAX_ROUNDS=18;
export const neighbors=id=>[id-3,id+3,id%3? id-1:-1,id%3<2?id+1:-1].filter(n=>n>=0&&n<NODES);
export const counts=g=>({player:g.owners.filter(x=>x===1).length,ai:g.owners.filter(x=>x===2).length});
export function newMatch(){
 return {owners:[1,0,0,0,0,0,0,0,2],energy:[0,5,5],round:1,phase:'playing',last:'點相鄰節點，擴張你的領地。'};
}
export function canCapture(g,side,node){
 if(g.phase!=='playing'||!Number.isInteger(node)||node<0||node>=NODES||g.owners[node]===side)return false;
 const linked=neighbors(node).some(n=>g.owners[n]===side);
 return linked&&g.energy[side]>=(g.owners[node]?4:2);
}
export function capture(g,side,node){
 if(!canCapture(g,side,node))return false;
 g.energy[side]-=g.owners[node]?4:2;g.owners[node]=side;
 g.last=(side===1?'玩家':'AI')+' 佔領節點 '+(node+1);return true;
}
export function chooseAi(g){
 const choices=[...Array(NODES).keys()].filter(id=>canCapture(g,2,id));
 if(!choices.length)return null;
 choices.sort((a,b)=>{
  const priority=id=>(g.owners[id]===1?3:0)+neighbors(id).filter(n=>g.owners[n]===0).length;
  return priority(b)-priority(a)||a-b;
 });
 return choices[0];
}
export function evaluate(g){
 const c=counts(g);
 if(c.player>=6||c.ai>=6||g.round>MAX_ROUNDS||!g.owners.includes(0)){
  g.phase=c.player===c.ai?'draw':c.player>c.ai?'won':'lost';
 }
 return g.phase;
}
export function playTurn(g,node){
 if(!capture(g,1,node))return false;
 evaluate(g);if(g.phase!=='playing')return true;
 g.energy[2]=Math.min(10,g.energy[2]+2);
 const ai=chooseAi(g);
 if(ai!==null)capture(g,2,ai);
 g.energy[1]=Math.min(10,g.energy[1]+2);
 g.round++;
 evaluate(g);return true;
}
