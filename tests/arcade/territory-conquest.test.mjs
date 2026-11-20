import test from 'node:test';
import assert from 'node:assert/strict';
import {NODES,neighbors,newMatch,canCapture,capture,playTurn,chooseAi,counts} from '../../dist/games/territory-conquest/engine.mjs';
test('orthogonal grid adjacency never wraps rows',()=>{
 assert.equal(NODES,9);
 assert.deepEqual(neighbors(0).sort((a,b)=>a-b),[1,3]);
 assert.deepEqual(neighbors(2).sort((a,b)=>a-b),[1,5]);
});
test('invalid or nonadjacent captures do not consume energy',()=>{
 const g=newMatch();
 assert.equal(playTurn(g,8),false);
 assert.equal(g.energy[1],5);
 assert.equal(playTurn(g,1),true);
 assert.equal(g.owners[1],1);
 assert.ok(g.round===2||g.phase!=='playing');
});
test('enemy nodes cost more than neutral and AI respects ownership',()=>{
 const g=newMatch();g.owners[1]=2;g.energy[1]=3;
 assert.equal(canCapture(g,1,1),false);
 g.energy[1]=4;assert.equal(capture(g,1,1),true);
 assert.equal(g.owners[1],1);assert.equal(g.energy[1],0);
});
test('AI only chooses legal adjacent nodes and cannot spend fake coins',()=>{
 const g=newMatch();const ai=chooseAi(g);
 assert.ok(ai===5||ai===7);
 assert.ok(canCapture(g,2,ai));
 assert.equal(capture(g,2,ai),true);
 assert.equal(counts(g).ai,2);
});
test('six controlled nodes wins and ends further actions',()=>{
 const g=newMatch();g.owners=[1,1,1,1,1,0,0,0,2];g.energy[1]=10;
 assert.equal(playTurn(g,5),true);
 assert.equal(g.phase,'won');assert.equal(playTurn(g,6),false);
});
