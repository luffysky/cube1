export const SIZE=7;
export const LEVELS=[
 {name:'第一關・轉折',source:[0,3,'E'],target:[2,0],mirrors:[{x:2,y:3,kind:'\\'}],walls:[]},
 {name:'第二關・光之階梯',source:[0,4,'E'],target:[6,1],mirrors:[{x:3,y:4,kind:'\\'},{x:3,y:1,kind:'\\'}],walls:[[5,4]]},
 {name:'第三關・回折',source:[0,5,'E'],target:[1,0],mirrors:[{x:4,y:5,kind:'\\'},{x:4,y:2,kind:'/'},{x:1,y:2,kind:'/'}],walls:[[5,5]]}
];
export function makeLevel(index=0){
 if(!Number.isSafeInteger(index)||index<0||index>=LEVELS.length)throw Error('invalid_level');
 return {index,mirrors:LEVELS[index].mirrors.map(m=>({...m})),moves:0};
}
const dx={E:1,W:-1,N:0,S:0},dy={E:0,W:0,N:-1,S:1};
const ref={'/':{E:'N',N:'E',W:'S',S:'W'},'\\':{E:'S',S:'E',W:'N',N:'W'}};
export function trace(level){
 const scene=LEVELS[level.index],mirrors=new Map(level.mirrors.map(m=>[m.x+','+m.y,m.kind]));
 const walls=new Set(scene.walls.map(p=>p.join(',')));
 let [x,y,d]=scene.source;const segments=[[x,y]],visited=new Set();
 for(let i=0;i<SIZE*SIZE*4;i++){
   const state=[x,y,d].join(',');if(visited.has(state))return {segments,won:false,reason:'loop'};
   visited.add(state);x+=dx[d];y+=dy[d];
   if(x<0||y<0||x>=SIZE||y>=SIZE)return {segments,won:false,reason:'escaped'};
   segments.push([x,y]);
   if(walls.has(x+','+y))return {segments,won:false,reason:'blocked'};
   if(x===scene.target[0]&&y===scene.target[1])return {segments,won:true,reason:'target'};
   if(mirrors.has(x+','+y))d=ref[mirrors.get(x+','+y)][d];
 }
 return {segments,won:false,reason:'loop'};
}
export function rotate(level,x,y){
 const mirror=level.mirrors.find(m=>m.x===x&&m.y===y);
 if(!mirror)return false;
 mirror.kind=mirror.kind==='/'?'\\':'/';level.moves++;return true;
}
export function reset(level){
 level.mirrors=makeLevel(level.index).mirrors;level.moves=0;return level;
}
export function hint(level){
 const solved=[['/'],['/','/'],['/','\\','\\']][level.index];
 const at=level.mirrors.findIndex((m,i)=>m.kind!==solved[i]);
 return at<0?null:{x:level.mirrors[at].x,y:level.mirrors[at].y};
}
