// Concentric rotating labyrinth, 8 angular sectors, 3 ring gates.
export const SEGMENTS=8;
export const STAGES=[
 {name:'入口迴廊',gates:[1,3,6],start:0},
 {name:'逆時鐘',gates:[7,2,5],start:4},
 {name:'終界之門',gates:[6,0,3],start:2}
];
export const wrap=n=>((n%SEGMENTS)+SEGMENTS)%SEGMENTS;
export function makeStage(index=0){
 if(!Number.isInteger(index)||index<0||index>=STAGES.length)throw Error('invalid_stage');
 const data=STAGES[index];return {index,gates:[...data.gates],sector:data.start,ring:0,turns:0,won:false};
}
export function turnAvatar(g,delta){
 if(g.won)return false;
 if(!Number.isInteger(delta)||Math.abs(delta)!==1)return false;
 g.sector=wrap(g.sector+delta);g.turns++;return true;
}
export function rotateRing(g,ring,delta=1){
 if(g.won||!Number.isInteger(ring)||ring<g.ring||ring>2||Math.abs(delta)!==1)return false;
 g.gates[ring]=wrap(g.gates[ring]+delta);g.turns++;return true;
}
export function escape(g){
 if(g.won)return false;
 if(g.gates[g.ring]!==g.sector)return false;
 g.ring++;
 if(g.ring>=3){g.won=true;g.ring=3;}
 return true;
}
