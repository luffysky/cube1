import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES,makeStage,turnAvatar,rotateRing,escape,wrap} from '../../dist/games/orbit-escape/engine.mjs';
test('all original concentric mazes require sequential gate alignment',()=>{
 assert.equal(STAGES.length,3);
 for(let i=0;i<3;i++){
  const g=makeStage(i);assert.equal(escape(g),false);
  for(let ring=0;ring<3;ring++){
    while(g.sector!==g.gates[ring])turnAvatar(g,1);
    assert.equal(escape(g),true);
  }
  assert.equal(g.won,true);assert.equal(g.ring,3);
 }
});
test('ring rotations are bounded, completed rings cannot be tampered with',()=>{
 const g=makeStage(0);assert.equal(wrap(-1),7);
 const before=g.gates[0];rotateRing(g,0,-1);assert.equal(g.gates[0],wrap(before-1));
 while(g.gates[0]!==g.sector)turnAvatar(g,1);
 escape(g);assert.equal(rotateRing(g,0,1),false);
});
test('finished state cannot score again',()=>{
 const g=makeStage(2);
 for(let i=0;i<3;i++){while(g.sector!==g.gates[i])turnAvatar(g,1);escape(g);}
 assert.equal(escape(g),false);assert.equal(turnAvatar(g,1),false);
});
