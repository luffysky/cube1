// SPINREALM casual friend-room gateway, Cloudflare Durable Objects.
// Guests only: no ranked rating, coins, wallet, paid items, or shared identity.
// The server owns Game state; clients send actions, never scores or boards.
import { Game } from '../dist/games/spinrealm/engine.mjs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACTIONS = new Set(['left','right','soft','hard','cw','ccw','hold']);
const MAX_PLAYERS = 4, TICK_MS = 50, MAX_DURATION_MS = 120000;
const clone = value => JSON.parse(JSON.stringify(value));
const codeOK = code => /^[A-HJ-NP-Z2-9]{10}$/.test(code);
const randomString = length => {
  const bytes = new Uint8Array(length); crypto.getRandomValues(bytes);
  return [...bytes].map(v => ALPHABET[v % ALPHABET.length]).join('');
};
const send = (ws, data) => { try { if(ws.readyState===1) ws.send(JSON.stringify(data)); } catch {} };
export const validAction = value => typeof value==='string' && ACTIONS.has(value);
export const validSequence = value => Number.isSafeInteger(value)&&value>0&&value<=1000000000;
export const safeName = value => typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,20) || '玩家' : '玩家';
const visibleGame = (game, mine) => ({
  board: clone(game.board), active: clone(game.active),
  queue: mine ? game.queue.slice(0,5) : [],
  held: mine ? game.held : null,
  canHold: mine ? game.canHold : false,
  status: game.status, stats: clone(game.stats),
});
const errorResponse = (status, code, origin) =>
  Response.json({error:code},{status,headers:headers(origin)});
const ALLOWED_ORIGINS = new Set([
  'https://games.snowrealm.pet',
  'https://luffysky.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);
const headers = origin => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin)?origin:'null',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Vary':'Origin',
  'Cache-Control':'private, no-store'
});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin')||'';
    if(!ALLOWED_ORIGINS.has(origin)) return errorResponse(403,'origin_denied',origin);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
    if(url.pathname==='/api/rooms'&&request.method==='POST'){
      const code = randomString(10);
      return Response.json({code,wsUrl:(url.protocol==='https:'?'wss:':'ws:')+'//'+url.host+'/api/rooms/'+code+'/connect'}, {status:201,headers:headers(origin)});
    }
    const match = /^\/api\/rooms\/([A-HJ-NP-Z2-9]{10})\/connect$/.exec(url.pathname);
    if(!match||request.method!=='GET')return errorResponse(404,'not_found',origin);
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return errorResponse(426,'websocket_required',origin);
    const id=env.ROOMS.idFromName(match[1]);
    return env.ROOMS.get(id).fetch(request);
  }
};

export class SpinrealmRoom {
  constructor(state,env){
    this.state=state;this.env=env;this.clients=new Map();this.players=new Map();
    this.phase='lobby';this.host=null;this.lastTick=0;this.clock=null;this.elapsed=0;
    this.nextStateAt=0;this.targetCursor=0;
  }
  async fetch(request){
    const pair=new WebSocketPair();
    const client=pair[0],ws=pair[1];ws.accept();
    this.clients.set(ws,null);
    ws.addEventListener('message',e=>this.onMessage(ws,e.data));
    ws.addEventListener('close',()=>this.onClose(ws));
    ws.addEventListener('error',()=>this.onClose(ws));
    send(ws,{type:'hello_required',rules:'guest-casual-1',maxPlayers:MAX_PLAYERS});
    return new Response(null,{status:101,webSocket:client});
  }
  everyone(message){for(const ws of this.clients.keys())if(this.clients.get(ws))send(ws,message);}
  playerOf(ws){const id=this.clients.get(ws);return id?this.players.get(id):null;}
  lobby(){
    const players=[...this.players.values()].map(p=>({id:p.id,name:p.name,online:!!p.ws,host:p.id===this.host}));
    this.everyone({type:'lobby',phase:this.phase,players,host:this.host,maxPlayers:MAX_PLAYERS});
  }
  join(ws,msg){
    if(this.clients.get(ws))return;
    let p=null;
    if(typeof msg.reconnect==='string'&&msg.reconnect.length===48){
      p=[...this.players.values()].find(row=>row.key===msg.reconnect)||null;
      if(p?.ws && p.ws!==ws){try{p.ws.close(4001,'reconnected');}catch{} this.clients.delete(p.ws);}
    }
    if(!p){
      if(this.phase!=='lobby'&&this.phase!=='ended')return send(ws,{type:'error',code:'match_running'});
      if(this.players.size>=MAX_PLAYERS)return send(ws,{type:'error',code:'room_full'});
      p={id:crypto.randomUUID(),name:safeName(msg.name),key:randomString(48),ws:null,
        game:null,pending:[],sent:0,cancelled:0,seq:0,windowAt:0,windowInputs:0};
      this.players.set(p.id,p);if(!this.host)this.host=p.id;
    }
    p.ws=ws;this.clients.set(ws,p.id);
    send(ws,{type:'welcome',you:p.id,reconnect:p.key,host:p.id===this.host,lastSeq:p.seq});
    this.lobby();
    if(this.phase==='playing'||this.phase==='ended')this.snapshot();
  }
  start(ws){
    const requester=this.playerOf(ws);
    if(!requester||requester.id!==this.host||this.phase==='playing')return;
    const active=[...this.players.values()].filter(p=>p.ws);
    if(active.length<2)return send(ws,{type:'error',code:'need_two_players'});
    // Offline seats are removed before a rematch. This never touches a persistent account.
    for(const [id,p] of this.players)if(!p.ws)this.players.delete(id);
    this.phase='playing';this.elapsed=0;this.targetCursor=0;
    const seed=randomString(24);this.lastTick=Date.now();this.nextStateAt=0;
    for(const p of this.players.values()){
      p.game=new Game({seed,gravity:700,lockDelay:500});
      p.pending=[];p.sent=0;p.cancelled=0;p.seq=0;p.windowAt=0;p.windowInputs=0;
    }
    this.everyone({type:'started',players:[...this.players.values()].map(p=>({id:p.id,name:p.name}))});
    this.snapshot();
    if(this.clock)clearInterval(this.clock);
    this.clock=setInterval(()=>this.advance(),TICK_MS);
  }
  input(ws,msg){
    const p=this.playerOf(ws);if(!p||this.phase!=='playing'||!p.game||p.game.status!=='playing')return;
    if(!validSequence(msg.seq)||msg.seq<=p.seq||!validAction(msg.action))return;
    const now=Date.now();
    if(now-p.windowAt>=1000){p.windowAt=now;p.windowInputs=0;}
    if(++p.windowInputs>70){send(ws,{type:'error',code:'input_rate_limited'});return;}
    p.seq=msg.seq;
    switch(msg.action){
      case 'left':p.game.move(-1);break;
      case 'right':p.game.move(1);break;
      case 'soft':p.game.softDrop();break;
      case 'hard':p.game.hardDrop();break;
      case 'cw':p.game.rotate(1);break;
      case 'ccw':p.game.rotate(-1);break;
      case 'hold':p.game.hold();break;
    }
  }
  signal(ws,msg){
    const sender=this.playerOf(ws);
    if(!sender||!msg||typeof msg.to!=='string'||typeof msg.payload!=='object'||msg.payload===null)return;
    const receiver=this.players.get(msg.to);
    if(!receiver?.ws||receiver.id===sender.id||JSON.stringify(msg.payload).length>8192)return;
    // Signaling is optional; all gameplay stays authoritative over WebSocket.
    const kind=msg.payload.type;
    if(!['offer','answer','candidate'].includes(kind))return;
    send(receiver.ws,{type:'rtc_signal',from:sender.id,payload:msg.payload});
  }
  onMessage(ws,raw){
    if(typeof raw!=='string'||raw.length>12000)return;
    let msg;try{msg=JSON.parse(raw);}catch{return;}
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='hello'){this.join(ws,msg);return;}
    if(msg.type==='start'){this.start(ws);return;}
    if(msg.type==='input'){this.input(ws,msg);return;}
    if(msg.type==='rtc_signal'){this.signal(ws,msg);return;}
    if(msg.type==='ping'){send(ws,{type:'pong',now:Date.now()});return;}
  }
  onClose(ws){
    const p=this.playerOf(ws);this.clients.delete(ws);
    if(!p||p.ws!==ws)return;
    p.ws=null;
    if(this.phase==='lobby'||this.phase==='ended'){
      // Reconnection keys stay valid for the lifetime of the room.
      if(p.id===this.host)this.host=[...this.players.values()].find(x=>x.ws)?.id||null;
      this.lobby();
    }else this.lobby();
  }
  resolveAttack(attacker,n){
    while(n>0&&attacker.pending.length){
      const packet=attacker.pending[0],k=Math.min(packet.n,n);
      n-=k;packet.n-=k;attacker.cancelled+=k;
      if(packet.n===0)attacker.pending.shift();
    }
    if(!n)return;
    const targets=[...this.players.values()].filter(p=>p.id!==attacker.id&&p.game?.status==='playing');
    if(!targets.length)return;
    // Round-robin target prevents one lock from multiplying damage by player count.
    const target=targets[this.targetCursor++%targets.length];
    target.pending.push({n,at:this.elapsed+1500});
    attacker.sent+=n;
    send(target.ws,{type:'attack',from:attacker.id,lines:n});
  }
  advance(){
    if(this.phase!=='playing')return;
    const now=Date.now(),dt=Math.min(100,Math.max(0,now-this.lastTick));this.lastTick=now;
    this.elapsed+=dt;
    for(const p of this.players.values())if(p.game?.status==='playing'){
      p.game.step(dt);
      const events=p.game.drainEvents();
      const locks=events.filter(x=>x.type==='lock');
      if(locks.length){
        const attack=locks.reduce((a,e)=>a+e.attack,0);
        if(attack)this.resolveAttack(p,attack);
        while(p.pending.length&&p.pending[0].at<=this.elapsed){
          p.game.addGarbage(p.pending.shift().n);
        }
      }
    }
    const alive=[...this.players.values()].filter(p=>p.game?.status==='playing');
    if(alive.length<=1||this.elapsed>=MAX_DURATION_MS){
      const sorted=[...this.players.values()].sort((a,b)=>(b.game?.status==='playing'?1:0)-(a.game?.status==='playing'?1:0)||b.sent-a.sent);
      const tie=sorted.length>1&&sorted[0].sent===sorted[1].sent&&sorted[0].game?.status===sorted[1].game?.status;
      const winner=tie?null:sorted[0]?.id||null;
      this.phase='ended';if(this.clock)clearInterval(this.clock);this.clock=null;
      this.snapshot();this.everyone({type:'ended',winner,reason:alive.length<=1?'last_standing':'time'});
      return;
    }
    if(this.elapsed>=this.nextStateAt){this.nextStateAt=this.elapsed+100;this.snapshot();}
  }
  snapshot(){
    for(const [ws,id] of this.clients){
      if(!id)continue;
      const roster=[...this.players.values()].map(p=>({
        id:p.id,name:p.name,online:!!p.ws,sent:p.sent,cancelled:p.cancelled,
        ...(p.id===id?{ackSeq:p.seq}:{}),
        incoming:p.pending.reduce((total,packet)=>total+packet.n,0),
        game:p.game?visibleGame(p.game,p.id===id):null
      }));
      send(ws,{type:'state',phase:this.phase,you:id,elapsedMs:Math.round(this.elapsed),durationMs:MAX_DURATION_MS,players:roster});
    }
  }
}
