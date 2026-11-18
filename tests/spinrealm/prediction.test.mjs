import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../../dist/games/spinrealm/engine.mjs';
import { predictionFromSnapshot } from '../../dist/games/spinrealm/prediction.mjs';

function snapshot(game){return Object.fromEntries(['board','active','queue','held','canHold','status','stats'].map(key=>[key,structuredClone(key==='queue'?game[key].slice(0,5):game[key])]));}
test('prediction consumes only published pieces and never changes the authoritative snapshot',()=>{
  const server=new Game({seed:444}),data=snapshot(server),original=structuredClone(data),game=predictionFromSnapshot(data);
  const next=data.queue[0];game.hold();assert.equal(game.active.type,next);assert.equal(game.queue.length,4);
  assert.deepEqual(data,original);assert.equal(game.stats.score,data.stats.score);
  game.hardDrop();assert.equal(game.queue.length,3);assert.equal(game.active.type,data.queue[1]);assert.deepEqual(data,original);
});
test('prediction waits safely when public lookahead ends instead of generating a hidden bag',()=>{
  const data=snapshot(new Game({seed:7}));data.queue=[];
  const byDrop=predictionFromSnapshot(data);byDrop.hardDrop();assert.equal(byDrop.status,'waiting');assert.equal(byDrop.active,null);assert.equal(byDrop.queue.length,0);assert.doesNotThrow(()=>byDrop.step(5000));assert.equal(byDrop.hardDrop(),false);
  const byHold=predictionFromSnapshot(data);byHold.hold();assert.equal(byHold.status,'waiting');assert.equal(byHold.active,null);assert.equal(byHold.hold(),false);
});
test('a new authoritative snapshot resumes prediction after waiting',()=>{
  const source=new Game({seed:44}),data=snapshot(source);data.queue=[];
  const waiting=predictionFromSnapshot(data);waiting.hardDrop();source.hardDrop();
  const resumed=predictionFromSnapshot(snapshot(source));assert.equal(resumed.status,'playing');assert.deepEqual(resumed.board,source.board);assert.deepEqual(resumed.active,source.active);assert.equal(resumed.queue.length,5);
});
