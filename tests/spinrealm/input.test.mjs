import test from 'node:test';
import assert from 'node:assert/strict';
import { InputRepeater } from '../../dist/games/spinrealm/input.mjs';
import { Game } from '../../dist/games/spinrealm/engine.mjs';

test('first input is immediate, repeat starts only after DAS, duplicate press is ignored', () => {
  const actions=[]; const input=new InputRepeater(()=>({das:120,arr:20,soft:25}),(a,all)=>actions.push([a,all]));
  input.press('left'); input.press('left');
  assert.equal(actions.length,1);
  input.step(119); assert.equal(actions.length,1);
  input.step(1); assert.equal(actions.length,2);
  input.step(40); assert.equal(actions.length,4);
  input.release('left'); input.step(300); assert.equal(actions.length,4);
});
test('repeat count is independent of render-sized delta partitions',()=>{
  function run(deltas){const result=[];const input=new InputRepeater(()=>({das:130,arr:25,soft:25}),(a)=>result.push(a));input.press('right');for(const dt of deltas)input.step(dt);return result;}
  assert.deepEqual(run(Array(120).fill(1000/120)),run(Array(60).fill(1000/60)));
  assert.deepEqual(run(Array(60).fill(1000/60)),run(Array(144).fill(1000/144)));
});
test('zero ARR slides only after DAS; sonic soft drop does not request a hard drop',()=>{
  const actions=[];const input=new InputRepeater(()=>({das:100,arr:0,soft:0}),(a,all)=>actions.push([a,all]));
  input.press('right');input.step(99);assert.deepEqual(actions,[['right',false]]);
  input.step(1);assert.deepEqual(actions.at(-1),['right',true]);
  input.press('soft');assert.deepEqual(actions.at(-1),['soft',true]);
  assert.equal(actions.some(([a])=>a==='hard'),false);
});
test('last horizontal direction wins and clearing input prevents stuck movement',()=>{
  const actions=[];const input=new InputRepeater(()=>({das:100,arr:20,soft:25}),(a)=>actions.push(a));
  input.press('left');input.press('right');input.step(100);assert.equal(actions.at(-1),'right');
  input.release('right');assert.equal(actions.at(-1),'left');
  input.clear();const n=actions.length;input.step(200);assert.equal(actions.length,n);
});
test('holding the exchange input across a placement never swaps the next piece automatically',()=>{
  const game=new Game({seed:'hold-input'});
  const input=new InputRepeater(()=>({das:130,arr:25,soft:25}),(action)=>{
    if(action==='hold')game.hold();
    else if(action==='hard')game.hardDrop();
  });
  const original=game.active.type;
  input.press('hold');
  assert.equal(game.held,original);
  assert.equal(game.canHold,false);
  input.press('hard');
  const nextPiece=game.active.type;
  assert.equal(game.canHold,true);
  input.step(5000);
  input.press('hold');
  assert.equal(game.active.type,nextPiece);
  assert.equal(game.held,original);
  input.release('hold');input.press('hold');
  assert.equal(game.active.type,original);
  assert.equal(game.held,nextPiece);
  assert.equal(game.canHold,false);
});
