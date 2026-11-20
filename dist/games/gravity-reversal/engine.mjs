// Gravity Reversal: fixed-cell collision mechanics, no nondeterministic physics.
export const WIDTH=12,HEIGHT=8;
export const LEVELS=[
 {name:'第一關・躍越',start:[1,6],goal:[10,6],walls:[[5,3],[5,4],[5,5],[5,6],[5,7]]},
 {name:'第二關・雙重障壁',start:[1,6],goal:[10,1],walls:[[3,0],[3,1],[3,2],[3,3],[7,4],[7,5],[7,6],[7,7]]},
 {name:'第三關・夾縫',start:[1,6],goal:[10,6],walls:[[4,3],[4,4],[4,5],[4,6],[4,7],[8,0],[8,1],[8,2],[8,3]]}
];
export function makeLevel(index=0){
 if(!Number.isInteger(index)||index<0||index>=LEVELS.length)throw Error('invalid_level');
 const data=LEVELS[index];return {index,x:data.start[0],y:data.start[1],gravity:1,moves:0,won:false,paused:false};
}
export function blocked(game,x,y){
 if(x<0||x>=WIDTH||y<0||y>=HEIGHT)return true;
 return LEVELS[game.index].walls.some(([a,b])=>x===a&&y===b);
}
function finish(g){const [x,y]=LEVELS[g.index].goal;if(g.x===x&&g.y===y)g.won=true;}
export function walk(game,direction){
 if(game.won||game.paused||![-1,1].includes(direction))return false;
 if(blocked(game,game.x+direction,game.y))return false;
 game.x+=direction;game.moves++;finish(game);return true;
}
export function flip(game){
 if(game.won||game.paused)return false;
 game.gravity*=-1;game.moves++;return true;
}
export function fall(game){
 if(game.won||game.paused)return false;
 if(blocked(game,game.x,game.y+game.gravity))return false;
 game.y+=game.gravity;finish(game);return true;
}
