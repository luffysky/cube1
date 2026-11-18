import { api, memberState, subscribeMember } from './member-client.mjs';

const ACTIONS=new Set(['left','right','soft','hard','cw','ccw','hold']);
const MIN_SEND_MS=100;
// The server owns state and results. Pending commands remain available for
// visual prediction until applied, even after the server acknowledges receipt.
export class RankedClient {
  constructor({onQueue=()=>{},onSnapshot=()=>{},onError=()=>{},request=api,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}) {
    Object.assign(this,{onQueue,onSnapshot,onError,request,now,schedule,cancel});
    this.generation=0;this.timer=0;this.flushTimer=0;this.matchId=null;this.queued=false;this.pending=[];this.seq=0;
    this.sending=false;this.polling=false;this.closed=false;this.lastTick=-1;this.lastAccepted=0;this.lastApplied=0;
    this.readyAt=Infinity;this.hasSnapshot=false;this.nextSendAt=0;this.inputFailures=0;this.pollFailures=0;this.queueSerial=Promise.resolve();
    this.identity=memberState().user?.id||null;
    this.unsubscribe=subscribeMember(state=>{
      const identity=state.user?.id||null;
      if(identity===this.identity)return;
      this.identity=identity;
      if(!this.matchId&&!this.queued)return;
      this.clearTimers();++this.generation;this.closed=true;this.queued=false;this.matchId=null;this.pending=[];
      this.sending=false;this.polling=false;this.hasSnapshot=false;this.readyAt=Infinity;
      this.onQueue({status:'idle',reason:'session_changed'});
    });
  }
  clearTimers(){this.cancel(this.timer);this.cancel(this.flushTimer);this.timer=0;this.flushTimer=0;}
  queueRequest(method){
    // Serializing join/cancel/poll prevents a late POST from rejoining the queue
    // after DELETE has already returned. Aborting a fetch alone cannot do this.
    const result=this.queueSerial.catch(()=>{}).then(()=>this.request('/v1/ranked/queue',{method,...(method==='GET'?{}:{body:{}})}));
    this.queueSerial=result.catch(()=>{});return result;
  }
  async join() {
    if(this.matchId||this.queued)return;
    this.clearTimers();const generation=++this.generation;this.closed=false;this.queued=true;this.onQueue({status:'joining'});
    try{const data=await this.queueRequest('POST');if(generation===this.generation)this.acceptQueue(data);}
    catch(error){if(generation!==this.generation)return;this.queued=false;this.onQueue({status:'idle'});this.onError(error);}
  }
  acceptQueue(data) {
    if(this.closed)return;
    this.cancel(this.timer);
    if(data.status==='matched'){
      this.matchId=data.matchId;this.queued=false;this.pending=[];this.seq=0;this.lastTick=-1;this.lastAccepted=0;this.lastApplied=0;
      this.readyAt=Infinity;this.hasSnapshot=false;this.sending=false;this.polling=false;this.inputFailures=0;this.pollFailures=0;this.nextSendAt=0;
      this.onQueue(data);void this.poll();
    }else if(data.status==='queued'){
      this.queued=true;this.onQueue(data);const generation=this.generation;
      this.timer=this.schedule(()=>{if(generation===this.generation)void this.pollQueue();},Math.max(1500,data.pollAfterMs||2000));
    }else{this.queued=false;this.onQueue({status:'idle'});}
  }
  async pollQueue() {
    if(!this.queued||this.closed)return;
    const generation=this.generation;
    try{const data=await this.queueRequest('GET');if(generation===this.generation)this.acceptQueue(data);}
    catch(error){
      if(generation!==this.generation)return;this.onError(error);
      if(this.queued&&!this.closed)this.timer=this.schedule(()=>{if(generation===this.generation)void this.pollQueue();},Math.max(3000,(error.details?.retryAfter||0)*1000));
    }
  }
  async leave() {
    this.clearTimers();const generation=++this.generation;this.closed=true;this.queued=false;this.sending=false;this.polling=false;
    const data=await this.queueRequest('DELETE');
    if(generation!==this.generation)return data;
    // If matching won the race with cancellation, keep the real match visible.
    if(data?.status==='matched'){this.closed=false;this.acceptQueue(data);}
    else{this.matchId=null;this.pending=[];this.onQueue({status:'idle'});}
    return data;
  }
  acceptSnapshot(data,generation=this.generation) {
    if(generation!==this.generation||this.closed||data.id!==this.matchId||data.tick<this.lastTick)return;
    const accepted=data.lastAcceptedSeq?.[data.you]||0,applied=data.lastAppliedSeq?.[data.you]||0;
    if(data.status!=='ended'&&(accepted<this.lastAccepted||applied<this.lastApplied))return;
    this.lastTick=data.tick;this.lastAccepted=Math.max(this.lastAccepted,accepted);this.lastApplied=Math.max(this.lastApplied,applied);
    this.seq=Math.max(this.seq,this.lastAccepted);this.pending=this.pending.filter(input=>input.seq>this.lastApplied);
    this.hasSnapshot=true;this.readyAt=this.now()+Math.max(0,data.countdownMs||0);
    if(data.status==='ended'){
      this.clearTimers();this.closed=true;this.pending=[];this.matchId=null;this.sending=false;this.polling=false;++this.generation;
    }
    this.onSnapshot(data,this.pending.slice());
    if(data.status!=='ended')this.scheduleFlush();
  }
  async poll() {
    if(this.polling||this.closed||!this.matchId)return;
    const generation=this.generation,id=this.matchId;this.polling=true;let delay=250;
    try{const data=await this.request(`/v1/matches/${id}`);if(generation!==this.generation)return;this.pollFailures=0;this.acceptSnapshot(data,generation);}
    catch(error){if(generation!==this.generation)return;this.pollFailures++;this.onError(error);delay=Math.max(Math.min(4000,500*2**Math.min(3,this.pollFailures)),(error.details?.retryAfter||0)*1000);}
    finally{
      if(generation===this.generation){this.polling=false;if(!this.closed&&this.matchId)this.timer=this.schedule(()=>{if(generation===this.generation)void this.poll();},delay);}
    }
  }
  input(action) {
    if(this.closed||!this.matchId||!this.hasSnapshot||this.now()<this.readyAt||this.pending.length>=128||!ACTIONS.has(action))return false;
    this.pending.push({seq:++this.seq,action});this.scheduleFlush();return true;
  }
  scheduleFlush(){
    if(this.sending||this.flushTimer||this.closed||!this.matchId||!this.pending.some(input=>input.seq>this.lastAccepted))return;
    const generation=this.generation,delay=Math.max(0,this.nextSendAt-this.now(),this.readyAt-this.now());
    this.flushTimer=this.schedule(()=>{this.flushTimer=0;if(generation===this.generation)void this.flush();},delay);
  }
  async flush() {
    if(this.sending||this.closed||!this.matchId)return;
    if(this.now()<this.nextSendAt||this.now()<this.readyAt){this.scheduleFlush();return;}
    const batch=this.pending.filter(input=>input.seq>this.lastAccepted).slice(0,32);if(!batch.length)return;
    const generation=this.generation,id=this.matchId;this.sending=true;this.nextSendAt=this.now()+MIN_SEND_MS;
    try{
      const data=await this.request(`/v1/matches/${id}/inputs`,{method:'POST',body:{inputs:batch}});
      if(generation!==this.generation)return;this.inputFailures=0;this.acceptSnapshot(data,generation);
    }catch(error){
      if(generation!==this.generation)return;
      this.inputFailures++;this.onError(error);
      this.nextSendAt=this.now()+Math.max(Math.min(4000,250*2**Math.min(4,this.inputFailures)),(error.details?.retryAfter||0)*1000);
      // Unknown server outcomes retry identical sequence numbers. A definitive
      // format rejection cannot be fixed by resending the same invalid batch.
      if(error.status===400){const rejected=new Set(batch.map(input=>input.seq));this.pending=this.pending.filter(input=>!rejected.has(input.seq));}
    }finally{if(generation===this.generation){this.sending=false;this.scheduleFlush();}}
  }
  async forfeit() {
    if(!this.matchId)return this.leave();
    const generation=this.generation,id=this.matchId;
    const data=await this.request(`/v1/matches/${id}/forfeit`,{method:'POST',body:{}});
    this.acceptSnapshot(data,generation);return data;
  }
}
