import test from 'node:test';
import assert from 'node:assert/strict';
import { SpinrealmRoom, validAction, validSequence, safeName } from '../../realtime/worker.mjs';

const socket=()=>({
  readyState:1,
  messages:[],
  send(payload){this.messages.push(JSON.parse(payload));},
  close(){this.readyState=3;}
});
const join=(room,name)=>{
  const ws=socket();room.clients.set(ws,null);room.join(ws,{type:'hello',name});
  return {ws,id:room.clients.get(ws)};
};

test('action whitelist and nickname sanitization reject untrusted fields',()=>{
  assert.equal(validAction('left'),true);assert.equal(validAction('win'),false);
  assert.equal(validSequence(1),true);assert.equal(validSequence(-1),false);
  assert.equal(validSequence(1.2),false);
  assert.equal(safeName('<img src=x>'), 'img src=x');
});

test('casual rooms require two players, allow four and never trust client-reported wins',()=>{
  const room=new SpinrealmRoom({},{});
  const a=join(room,'Alice');
  assert.ok(a.id);room.start(a.ws);assert.equal(room.phase,'lobby');
  const b=join(room,'Bob');
  room.start(a.ws);assert.equal(room.phase,'playing');
  try{
    const pa=room.players.get(a.id),pb=room.players.get(b.id);
    assert.equal(pa.game.stats.score,0);
    room.input(a.ws,{seq:1,action:'right',board:Array(22).fill('G'),score:999999});
    assert.equal(pa.seq,1);assert.equal(pa.game.active.x,4);
    room.input(a.ws,{seq:1,action:'right'});assert.equal(pa.game.active.x,4);
    room.input(a.ws,{seq:2,action:'win'});assert.equal(pa.seq,1);
    room.lastTick=Date.now()-60;room.advance();
    assert.equal(pa.game.board[20].every(x=>x===null),true);
    const update=b.ws.messages.filter(x=>x.type==='state').at(-1);
    assert.ok(update.players.find(x=>x.id===b.id).game.queue.length===5);
    assert.equal(update.players.find(x=>x.id===a.id).game.queue.length,0);
    assert.equal(room.phase,'playing');
    assert.ok(pb.game);
  }finally{if(room.clock)clearInterval(room.clock);}
});

test('room rejects a fifth seat and never allows the wrong player to start',()=>{
  const room=new SpinrealmRoom({},{});
  const sockets=['A','B','C','D'].map(n=>join(room,n));
  const fifth=join(room,'E');
  assert.equal(room.players.size,4);
  assert.equal(fifth.id,null);
  assert.equal(fifth.ws.messages.at(-1).code,'room_full');
  room.start(sockets[1].ws);assert.equal(room.phase,'lobby');
});


test('RTC offer relay requires both players to opt in; host moves on disconnect',()=>{
  const room=new SpinrealmRoom({},{});
  const alice=join(room,'Alice'),bob=join(room,'Bob');
  const offer={type:'offer',sdp:'test-offer'};
  room.signal(alice.ws,{to:bob.id,payload:offer});
  assert.equal(bob.ws.messages.some(m=>m.type==='rtc_signal'),false);
  room.onMessage(alice.ws,JSON.stringify({type:'rtc_ready',enabled:true}));
  room.signal(alice.ws,{to:bob.id,payload:offer});
  assert.equal(bob.ws.messages.some(m=>m.type==='rtc_signal'),false);
  room.onMessage(bob.ws,JSON.stringify({type:'rtc_ready',enabled:true}));
  room.signal(alice.ws,{to:bob.id,payload:offer});
  assert.equal(bob.ws.messages.filter(m=>m.type==='rtc_signal').length,1);
  room.onMessage(bob.ws,JSON.stringify({type:'rtc_ready',enabled:false}));
  room.signal(alice.ws,{to:bob.id,payload:offer});
  assert.equal(bob.ws.messages.filter(m=>m.type==='rtc_signal').length,1);
  room.onClose(alice.ws);
  assert.equal(room.host,bob.id);
  assert.equal(room.players.get(alice.id).rtcReady,false);
});
