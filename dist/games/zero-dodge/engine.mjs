// SnowRealm Zero Dodge: deterministic simulation, with no server assets or paid advantage.
export const W=640,H=720,DURATION=60;
export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export function makeGame(rng=Math.random) {
  return {rng,phase:'ready',elapsed:0,spawn:0,life:3,score:0,comets:[],player:{x:320,y:630,r:13},invulnerable:0,spawned:0};
}
export function start(game) {
  game.phase='playing';game.elapsed=0;game.spawn=0;game.life=3;game.score=0;
  game.comets=[];game.player.x=W/2;game.player.y=H-90;game.invulnerable=0;game.spawned=0;return game;
}
export function move(game,x,y) {
  game.player.x=clamp(x,game.player.r,W-game.player.r);
  game.player.y=clamp(y,90,H-game.player.r);
}
export function togglePause(game) {
  if(game.phase==='playing')game.phase='paused';
  else if(game.phase==='paused')game.phase='playing';
  return game.phase;
}
export function tick(game,delta,axes={x:0,y:0}) {
  if(game.phase!=='playing')return game;
  const dt=clamp(Number.isFinite(delta)?delta:0,0,0.05);
  if(!dt)return game;
  const level=1+Math.floor(game.elapsed/10);
  const speed=310;const mag=Math.hypot(axes.x||0,axes.y||0)||1;
  move(game,game.player.x+clamp((axes.x||0)/mag,-1,1)*speed*dt,
    game.player.y+clamp((axes.y||0)/mag,-1,1)*speed*dt);
  game.elapsed=Math.min(DURATION,game.elapsed+dt);
  game.invulnerable=Math.max(0,game.invulnerable-dt);
  game.spawn+=dt;
  const interval=Math.max(.14,.69-(level-1)*.085);
  while(game.spawn>=interval){
    game.spawn-=interval;
    const x=24+game.rng()*(W-48);
    const r=8+game.rng()*11;
    const vy=145+level*25+game.rng()*80;
    const vx=(game.rng()-.5)*85;
    game.comets.push({x,y:-r,r,vx,vy});
    game.spawned++;
  }
  for(const ball of game.comets){
    ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
    const dist=Math.hypot(ball.x-game.player.x,ball.y-game.player.y);
    if(dist < ball.r+game.player.r-3 && game.invulnerable===0){
      game.life--;game.invulnerable=1.1;ball.y=H+100;
      if(game.life<=0){game.phase='lost';break;}
    }
  }
  game.comets=game.comets.filter(ball=>ball.y<=H+30&&ball.x>=-50&&ball.x<=W+50);
  game.score=Math.floor(game.elapsed*100);
  if(game.elapsed>=DURATION&&game.phase==='playing'){game.phase='won';game.score+=game.life*500;}
  return game;
}
