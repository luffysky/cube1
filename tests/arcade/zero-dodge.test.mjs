import test from 'node:test';
import assert from 'node:assert/strict';
import {W,H,DURATION,makeGame,start,move,togglePause,tick} from '../../dist/games/zero-dodge/engine.mjs';

test('new game starts ready with 3 lives and full 60-second objective',()=>{
 const g=makeGame(()=>.5);
 assert.equal(g.phase,'ready');start(g);assert.equal(g.phase,'playing');
 assert.equal(g.life,3);assert.equal(g.elapsed,0);assert.equal(DURATION,60);
});
test('keyboard and touch movement are bounded within the arena',()=>{
 const g=start(makeGame(()=>.5));
 move(g,-200,10000);assert.equal(g.player.x,g.player.r);
 assert.equal(g.player.y,H-g.player.r);
 move(g,W+100,0);assert.equal(g.player.x,W-g.player.r);
 assert.equal(g.player.y,90);
 tick(g,.05,{x:1,y:0});assert.ok(g.player.x<=W);
});
test('paused game does not spawn or advance and can resume',()=>{
 const g=start(makeGame(()=>.5));togglePause(g);tick(g,4,{x:1,y:1});
 assert.equal(g.elapsed,0);assert.equal(g.comets.length,0);
 togglePause(g);tick(g,.05);assert.ok(g.elapsed>0);
});
test('spawn pacing accelerates as time elapses',()=>{
 const g=start(makeGame(()=>.5));
 for(let i=0;i<200;i++)tick(g,.05);
 const initial=g.spawned;
 for(let i=0;i<200;i++)tick(g,.05);
 assert.ok(g.spawned-initial>initial/1.2);
});
test('collision reduces life and grants a short invulnerability window',()=>{
 const g=start(makeGame(()=>.5));
 g.comets=[{x:g.player.x,y:g.player.y,r:15,vx:0,vy:0}];
 tick(g,.016);assert.equal(g.life,2);
 g.comets=[{x:g.player.x,y:g.player.y,r:15,vx:0,vy:0}];
 tick(g,.016);assert.equal(g.life,2);
});
test('third collision ends game, replay resets safely',()=>{
 const g=start(makeGame(()=>.5));
 for(let k=0;k<3;k++){
   g.invulnerable=0;g.comets=[{x:g.player.x,y:g.player.y,r:15,vx:0,vy:0}];tick(g,.016);
 }
 assert.equal(g.phase,'lost');start(g);
 assert.equal(g.phase,'playing');assert.equal(g.life,3);assert.equal(g.score,0);
});
test('survival reaches victory at 60 seconds with bonus lives',()=>{
 const g=start(makeGame(()=>.5));g.player.y=90;
 // Test the clock without inventing a long in-browser animation.
 g.elapsed=59.99;tick(g,.05);
 assert.equal(g.phase,'won');assert.equal(g.score,6000+1500);
});
