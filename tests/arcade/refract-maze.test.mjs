import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,makeLevel,trace,rotate,reset,hint} from '../../dist/games/refract-maze/engine.mjs';
test('three different puzzles are solvable using mirror rotations',()=>{
 assert.equal(LEVELS.length,3);
 for(let i=0;i<LEVELS.length;i++){
  const g=makeLevel(i);assert.equal(trace(g).won,false);
  let steps=0;
  while(hint(g)&&steps++<10){const m=hint(g);rotate(g,m.x,m.y);}
  assert.equal(trace(g).won,true,'level '+i);
 }
});
test('non-mirror rotation does nothing, reset restores the original puzzle',()=>{
 const g=makeLevel(0);assert.equal(rotate(g,4,4),false);
 assert.equal(rotate(g,2,3),true);assert.equal(trace(g).won,true);
 reset(g);assert.equal(g.moves,0);assert.equal(trace(g).won,false);
});
test('invalid level is rejected, beam is bounded',()=>{
 assert.throws(()=>makeLevel(9),/invalid_level/);
 assert.ok(trace(makeLevel(2)).segments.length<=7*7*4+1);
});
