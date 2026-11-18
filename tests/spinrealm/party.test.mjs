import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HEIGHT, WIDTH } from '../../dist/games/spinrealm/engine.mjs';
import { Bot } from '../../dist/games/spinrealm/bot.mjs';
import { resolveExchange } from '../../dist/games/spinrealm/combat.mjs';
import {
  ITEMS, createPartyState, chargeEnergy, getPartyStatus, canUseItem, useItem,
  absorbGarbage, countGarbageRows, cleanseGarbage, chooseCpuItem,
} from '../../dist/games/spinrealm/party.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const rich = () => ({...createPartyState(),energy:100});
const lock = (lines=0,spin=null) => ({type:'lock',lines,spin,placedType:spin?'T':'I'});
const noBoard = game => {const result=copy(game);delete result.board;return result;};

test('fresh match state resets all effects and energy; charge follows actual lock/line/spin events and caps at 100', () => {
  const initial=createPartyState(),other=createPartyState();
  assert.equal(initial.energy,40);assert.notEqual(initial,other);
  let state=chargeEnergy(initial,lock());
  assert.equal(state.energy,45);assert.equal(initial.energy,40);
  state=chargeEnergy(state,lock(2,'full'));
  assert.equal(state.energy,74); // 5 + 2*8 + 8
  state=chargeEnergy(state,lock(4));assert.equal(state.energy,100);
  assert.deepEqual(createPartyState(),other);
});

test('non-lock or malformed events cannot farm energy', () => {
  const state=createPartyState();
  for(const event of [null,{}, {type:'cleanse',lines:2}, {type:'lock',lines:-1}, {type:'lock',lines:Infinity},
    {type:'lock',lines:1.5},lock(4,'full'),lock(2,'fake'),{...lock(2,'full'),placedType:'O'}]) {
    assert.equal(chargeEnergy(state,event).energy,40);
  }
});

test('unknown items, invalid/rewound time, insufficient energy and ended games cannot spend energy', () => {
  const game=new Game({seed:'invalid'});
  const cases=[
    [rich(),'unknown',0,{}], [rich(),'toString',0,{}], [rich(),'shield',NaN,{}],
    [rich(),'shield',-1,{}], [{...rich(),updatedAt:10},'shield',9,{}],
    [{...createPartyState(),energy:34},'shield',0,{}], [createPartyState(),'pulse',0,{}],
  ];
  game.status='over';cases.push([rich(),'pulse',0,{game}]);
  for(const [state,id,now,options] of cases){
    const before=copy(state),result=useItem(state,id,now,options);
    assert.equal(result.ok,false);assert.equal(result.attack,0);assert.equal(result.removed,0);
    assert.deepEqual(state,before);assert.deepEqual(result.state,before);
  }
});

test('shield lasts eight simulation seconds; a paused clock does not consume it', () => {
  const initial=createPartyState(),result=useItem(initial,'shield',1000);
  assert.equal(result.ok,true);assert.equal(result.state.energy,5);
  assert.equal(result.state.cooldownUntil,9000);assert.equal(result.state.shieldUntil,9000);
  assert.equal(initial.shieldRemaining,0);
  const frozen=getPartyStatus(result.state,2500);
  for(let i=0;i<10;i++)assert.deepEqual(getPartyStatus(result.state,2500),frozen);
  assert.equal(frozen.shieldRemaining,4);assert.equal(frozen.shieldRemainingMs,6500);
  assert.equal(getPartyStatus(result.state,8999).shieldRemaining,4);
  assert.equal(getPartyStatus(result.state,9000).shieldRemaining,0);
  assert.equal(getPartyStatus(result.state,9000).cooldownRemaining,0);
});

test('shield absorbs at most four total rows across packets and never amplifies garbage', () => {
  const shield=useItem(rich(),'shield',0).state;
  const a=absorbGarbage(shield,3,1000);
  assert.deepEqual([a.absorbed,a.remaining,a.state.shieldRemaining],[3,0,1]);
  const b=absorbGarbage(a.state,4,2000);
  assert.deepEqual([b.absorbed,b.remaining,b.state.shieldRemaining],[1,3,0]);
  const c=absorbGarbage(b.state,2,3000);
  assert.deepEqual([c.absorbed,c.remaining],[0,2]);
  assert.equal(shield.shieldRemaining,4,'input state remains unchanged');
  for(const rows of [-1,1.5,NaN,Infinity])assert.throws(()=>absorbGarbage(shield,rows,1000),TypeError);
});

test('expired shield absorbs nothing and a fresh restart cannot retain it', () => {
  const shield=useItem(rich(),'shield',500).state;
  const expired=absorbGarbage(shield,4,8500);
  assert.deepEqual([expired.absorbed,expired.remaining,expired.state.shieldRemaining],[0,4,0]);
  assert.equal(expired.state.shieldUntil,0);
  const restarted=createPartyState();
  assert.equal(restarted.energy,40);assert.equal(restarted.cooldownUntil,0);assert.equal(restarted.shieldRemaining,0);
});

test('one eight-second cooldown is shared by all three items and failed presses do not extend it', () => {
  let state=useItem(rich(),'shield',1000).state;
  state={...state,energy:100};
  const before=copy(state);
  for(const item of Object.keys(ITEMS)){
    const failed=useItem(state,item,8999,{game:new Game({seed:1})});
    assert.equal(failed.ok,false);assert.equal(failed.reason,'cooldown');assert.deepEqual(failed.state,before);
  }
  const pulse=useItem(state,'pulse',9000);
  assert.equal(pulse.ok,true);assert.equal(pulse.state.energy,55);assert.equal(pulse.state.cooldownUntil,17000);
});

test('pulse only describes two attack rows; it cannot modify the game, randomizer, events or incoming queues', () => {
  const game=new Game({seed:'pulse'}),before=copy(game),queue=[{n:3,at:1000}];
  const result=useItem({...createPartyState(),energy:45},'pulse',0,{game});
  assert.equal(result.ok,true);assert.equal(result.attack,2);assert.equal(result.state.energy,0);
  assert.deepEqual(copy(game),before);assert.deepEqual(queue,[{n:3,at:1000}]);
  const a=[],b=[];
  const exchange=resolveExchange({playerQueue:a,cpuQueue:b,playerAttack:result.attack,cpuAttack:2,now:0});
  assert.equal(exchange.playerSent,0);assert.equal(exchange.cpuSent,0);assert.deepEqual([a,b],[[],[]]);
});

test('pulse follows existing warning and shield rules when it actually enters', () => {
  const a=[],b=[];
  resolveExchange({playerQueue:a,cpuQueue:b,playerAttack:2,now:100});
  assert.deepEqual(b,[{n:2,at:1600}]);
  const shield=useItem(rich(),'shield',200).state;
  const entry=absorbGarbage(shield,b[0].n,1600);
  assert.equal(entry.absorbed,2);assert.equal(entry.remaining,0);
});

test('cleanse with no genuine garbage does not spend energy or start cooldown', () => {
  const game=new Game({seed:'empty'}),state=rich(),before=copy(game);
  game.board[HEIGHT-1][0]='T';
  const result=useItem(state,'cleanse',500,{game});
  assert.equal(result.ok,false);assert.equal(result.reason,'no_garbage');assert.deepEqual(result.state,state);
  assert.equal(result.state.cooldownUntil,0);assert.equal(game.board[HEIGHT-1][0],'T');
  assert.deepEqual(noBoard(game),(()=>{delete before.board;return before;})());
});

test('cleanse removes bottommost garbage only and preserves dimensions, colored cells, score, attacks, timers, RNG and pending events', () => {
  const game=new Game({seed:'cleanse'});
  game.hardDrop();game.addGarbage(3,4);
  game._gravityTimer=111;game._lockTimer=240;game._resetCount=5;
  const before=noBoard(game),colorCount=game.board.flat().filter(cell=>cell&&cell!=='G').length;
  const result=useItem(rich(),'cleanse',1000,{game});
  assert.equal(result.ok,true);assert.equal(result.removed,2);assert.equal(result.attack,0);
  assert.equal(result.state.energy,50);assert.equal(result.state.cooldownUntil,9000);
  assert.equal(game.board.length,HEIGHT);assert.ok(game.board.every(row=>row.length===WIDTH));
  assert.equal(countGarbageRows(game),1);
  assert.equal(game.board.flat().filter(cell=>cell&&cell!=='G').length,colorCount);
  assert.deepEqual(noBoard(game),before);
  assert.equal(game.collides(game.active),false);
  assert.equal(chargeEnergy(result.state,result).energy,50,'item result is not a lock event');
});

test('a row containing any colored piece is never a cleanse candidate', () => {
  const game=new Game({seed:'colored'});game.addGarbage(3,4);
  game.board[HEIGHT-1][0]='Z';
  const mixed=game.board[HEIGHT-1].slice();
  assert.equal(countGarbageRows(game),2);
  const result=cleanseGarbage(game);
  assert.equal(result.removed,2);assert.deepEqual(game.board[HEIGHT-1],mixed);
});

test('cleanse refuses to drop the stack through the active piece and charges nothing', () => {
  const game=new Game({seed:'blocked'});game.addGarbage(1,4);
  game.active={type:'O',x:3,y:18,rotation:0};game.board[17][4]='J';
  assert.equal(game.collides(game.active),false);
  const before=copy(game),state=rich();
  const check=canUseItem(state,'cleanse',0,{game});
  assert.equal(check.ok,false);assert.equal(check.reason,'active_blocked');
  const result=useItem(state,'cleanse',0,{game});
  assert.equal(result.ok,false);assert.deepEqual(copy(game),before);assert.deepEqual(result.state,state);
});

test('cleanse can safely remove one row when removing two would collide with the active piece', () => {
  const game=new Game({seed:'one-safe'});game.addGarbage(2,4);
  game.active={type:'O',x:3,y:18,rotation:0};game.board[16][4]='J';
  const active=copy(game.active);
  assert.equal(canUseItem(rich(),'cleanse',0,{game}).removed,1);
  const result=useItem(rich(),'cleanse',0,{game});
  assert.equal(result.ok,true);assert.equal(result.removed,1);assert.equal(countGarbageRows(game),1);
  assert.deepEqual(game.active,active);assert.equal(game.collides(game.active),false);
});

test('availability checks are pure and malformed cleanse requests do not mutate the game', () => {
  const game=new Game({seed:'pure-check'});game.addGarbage(3,2);
  const before=copy(game),state=rich();
  for(const item of Object.keys(ITEMS))canUseItem(state,item,0,{game});
  assert.deepEqual(copy(game),before);
  for(const rows of [0,-1,3,1.5,NaN,Infinity])assert.equal(cleanseGarbage(game,rows).ok,false);
  assert.deepEqual(copy(game),before);
});

test('CPU chooses defensive shield, real garbage cleanse or pulse under the same costs and cooldown', () => {
  const empty=new Game({seed:'cpu-choice'});
  assert.equal(chooseCpuItem(createPartyState(),0,{game:empty,incoming:[{n:2,at:1500}]}),'shield');
  assert.equal(chooseCpuItem(rich(),0,{game:empty,incoming:[]}),'pulse');
  const garbage=new Game({seed:'cpu-garbage'});garbage.addGarbage(2,1);
  assert.equal(chooseCpuItem(rich(),0,{game:garbage,incoming:[]}),'cleanse');
  const waiting=useItem(rich(),'pulse',0,{game:empty}).state;
  assert.equal(chooseCpuItem(waiting,7999,{game:garbage,incoming:[{n:8,at:8000}]}),null);
  assert.equal(chooseCpuItem(createPartyState(),0,{game:empty,incoming:[]}),null);
});

test('party shield and pulse preserve a genuine SRS T-spin double', () => {
  for(const item of ['shield','pulse']){
    const game=new Game({seed:1}).loadDrill('double');
    const before=copy(game);assert.equal(useItem(rich(),item,0,{game}).ok,true);
    assert.deepEqual(copy(game),before);
    game.rotate(1);game.hardDrop();
    const result=game.drainEvents().find(event=>event.type==='lock');
    assert.equal(result.spin,'full');assert.equal(result.lines,2);assert.equal(result.attack,4);
  }
});

test('existing CPU replans normally after a cleanse without touching SRS or creating illegal placements', () => {
  const game=new Game({seed:'bot-cleanse'}),bot=new Bot(game,{pps:2});
  bot.update(50);game.addGarbage(3,4);
  assert.equal(cleanseGarbage(game).removed,2);
  for(let i=0;i<180 && game.status==='playing';i++){
    game.step(1000/120);bot.update(1000/120);
    assert.equal(game.collides(game.active),false);
  }
  assert.ok(game.stats.pieces>=1);
});
