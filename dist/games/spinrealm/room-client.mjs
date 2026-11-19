// Guest-only friend-room transport. It cannot grant ranked rewards or account rights.
const ROOM_CODE = /^[A-HJ-NP-Z2-9]{10}$/;
const INPUTS = new Set(['left','right','soft','hard','cw','ccw','hold']);
export class RoomClient {
  constructor({baseUrl,onMessage=()=>{},onStatus=()=>{}}={}){
    this.baseUrl=typeof baseUrl==='string'?baseUrl.replace(/\/+$/,''):'';
    this.onMessage=onMessage;this.onStatus=onStatus;this.code='';this.ws=null;
    this.closed=true;this.seq=0;this.you=null;this.retry=0;this.retryTimer=null;
  }
  async create(){
    if(!this.baseUrl)throw new Error('room_service_not_configured');
    const response=await fetch(this.baseUrl+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
    if(!response.ok)throw new Error('room_create_failed_'+response.status);
    const info=await response.json();if(!ROOM_CODE.test(info.code))throw new Error('room_bad_response');
    await this.join(info.code);
    return info.code;
  }
  async join(input){
    if(!this.baseUrl)throw new Error('room_service_not_configured');
    const code=String(input||'').trim().toUpperCase();
    if(!ROOM_CODE.test(code))throw new Error('room_bad_code');
    this.close();
    this.code=code;this.closed=false;this.seq=0;this.you=null;this.retry=0;
    await this.open();
    return code;
  }
  url(){
    const u=new URL(this.baseUrl);
    if(!['https:','http:'].includes(u.protocol))throw new Error('room_bad_server');
    u.protocol=u.protocol==='https:'?'wss:':'ws:';
    u.pathname='/api/rooms/'+this.code+'/connect';u.search='';u.hash='';
    return u.toString();
  }
  keyName(){return 'spinrealm.room.reconnect.'+this.code;}
  readKey(){try{return sessionStorage.getItem(this.keyName())||'';}catch{return'';}}
  writeKey(key){try{sessionStorage.setItem(this.keyName(),key);}catch{}}
  async open(){
    const ws=new WebSocket(this.url());this.ws=ws;
    this.onStatus('connecting');
    return new Promise((resolve,reject)=>{
      let settled=false;
      ws.addEventListener('open',()=>{
        if(this.closed||ws!==this.ws){ws.close();return;}
        ws.send(JSON.stringify({type:'hello',name:this.displayName||'訪客',reconnect:this.readKey()}));
        this.retry=0;this.onStatus('connected');settled=true;resolve();
      },{once:true});
      ws.addEventListener('message',event=>{
        if(this.closed||ws!==this.ws)return;
        let msg;try{msg=JSON.parse(event.data);}catch{return;}
        if(!msg||typeof msg!=='object')return;
        if(msg.type==='welcome'){
          this.you=msg.you;this.seq=Math.max(this.seq,Number(msg.lastSeq)||0);
          if(typeof msg.reconnect==='string'&&msg.reconnect.length===48)this.writeKey(msg.reconnect);
        }
        this.onMessage(msg);
      });
      ws.addEventListener('error',()=>{if(!settled){settled=true;reject(new Error('room_connection_failed'));}});
      ws.addEventListener('close',()=>{
        if(!settled){settled=true;reject(new Error('room_connection_closed'));}
        if(this.closed||ws!==this.ws)return;
        this.onStatus('disconnected');
        this.retryTimer=setTimeout(()=>{if(!this.closed)void this.open().catch(()=>{});},Math.min(10000,500*2**Math.min(5,this.retry++)));
      });
    });
  }
  send(type,payload={}){
    if(this.closed||this.ws?.readyState!==WebSocket.OPEN)return false;
    this.ws.send(JSON.stringify({type,...payload}));return true;
  }
  start(){return this.send('start');}
  input(action){
    if(!INPUTS.has(action)||!this.you)return null;
    const seq=this.seq+1;
    if(!this.send('input',{action,seq}))return null;
    this.seq=seq;return seq;
  }
  rtcSignal(to,payload){return this.send('rtc_signal',{to,payload});}
  close(){
    this.closed=true;
    if(this.retryTimer)clearTimeout(this.retryTimer);
    this.retryTimer=null;
    const ws=this.ws;this.ws=null;
    if(ws&&ws.readyState<=WebSocket.OPEN)try{ws.close(1000,'leaving room');}catch{}
    this.onStatus('closed');
  }
}
