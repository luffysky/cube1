import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,makeLevel,walk,flip,fall,blocked} from '../../dist/games/gravity-reversal/engine.mjs';
test('three original gravity mazes have safe floor and ceiling',()=>{
 assert.equal(LEVELS.length,3);
 for(let i=0;i<3;i++){
  const g=makeLevel(i);
  assert.equal(blocked(g,-1,2),true);
  assert.equal(blocked(g,12,2),true);
  assert.equal(fall(g),true);
  while(fall(g)){}
  assert.equal(g.y,7);
  flip(g);while(fall(g)){}assert.equal(g.y,0);
 }
});
test('player cannot enter a wall or move outside board',()=>{
 const g=makeLevel(0);
 for(let i=0;i<10;i++)walk(g,1);
 assert.equal(g.x,4);assert.equal(walk(g,1),false);
});
test('gravity can bypass the floor barrier and reach goal',()=>{
 const g=makeLevel(0);
 flip(g);while(fall(g)){}
 for(let i=0;i<9;i++)walk(g,1);
 assert.equal(g.x,10);flip(g);
 while(fall(g)){}
 assert.equal(g.y,6);
 assert.equal(g.won,true);
 assert.equal(walk(g,-1),false);
});
test('paused and won states cannot change physics',()=>{
 const g=makeLevel(0);g.paused=true;
 assert.equal(flip(g),false);assert.equal(fall(g),false);assert.equal(walk(g,1),false);
});
