// Optional, consensual WebRTC data-channel RTT diagnostics.
// Gameplay authority, gold and ranks NEVER move over peer-to-peer channels.
export class RtcPeerLinks {
  constructor({signal=()=>false,changed=()=>{}}={}){
    this.signal=signal;this.changed=changed;this.enabled=false;this.you=null;
    this.peers=new Map();this.ready=new Set();
  }
  optIn(you,roster=[]){
    if(typeof RTCPeerConnection!=='function')return false;
    this.you=you;this.enabled=true;
    for(const member of roster)if(member.id!==you&&member.rtcReady)this.ready.add(member.id);
    for(const peer of this.ready)this.ensure(peer);
    this.changed('WebRTC 已啟用，等待雙方協商。');
    return true;
  }
  optOut(){
    this.enabled=false;this.ready.clear();
    for(const p of this.peers.values()){if(p.timer)clearInterval(p.timer);p.connection.close();}
    this.peers.clear();this.changed('WebRTC 已關閉；遊戲仍使用安全的 WebSocket。');
  }
  peerReady(id,enabled){
    if(!id||id===this.you)return;
    if(!enabled){
      this.ready.delete(id);
      const peer=this.peers.get(id);if(peer){if(peer.timer)clearInterval(peer.timer);peer.connection.close();this.peers.delete(id);}
      return;
    }
    this.ready.add(id);if(this.enabled)this.ensure(id);
  }
  ensure(id){
    if(!this.enabled||!this.ready.has(id)||this.peers.has(id)||!this.you)return;
    const connection=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    const peer={connection,channel:null,timer:null,candidates:[]};this.peers.set(id,peer);
    connection.onicecandidate=event=>{
      if(event.candidate)this.signal(id,{type:'candidate',candidate:event.candidate.toJSON()});
    };
    connection.onconnectionstatechange=()=>{
      this.changed('RTC '+id.slice(0,5)+': '+connection.connectionState+'；遊戲仍走 WebSocket。');
      if(['failed','closed'].includes(connection.connectionState)){if(peer.timer)clearInterval(peer.timer);}
    };
    connection.ondatachannel=event=>this.bindChannel(id,peer,event.channel);
    if(this.you<id){
      const channel=connection.createDataChannel('spinrealm-rtt',{ordered:false,maxRetransmits:0});
      this.bindChannel(id,peer,channel);
      void (async()=>{
        try{const offer=await connection.createOffer();await connection.setLocalDescription(offer);
          this.signal(id,{type:'offer',sdp:connection.localDescription.sdp});
        }catch{this.changed('WebRTC 協商失敗，維持 WebSocket。');}
      })();
    }
  }
  bindChannel(id,peer,channel){
    peer.channel=channel;
    channel.onopen=()=>{
      this.changed('RTC 直連成功：'+id.slice(0,5)+'（僅診斷，不傳遊戲操作）。');
      peer.timer=setInterval(()=>{if(channel.readyState==='open')channel.send(JSON.stringify({kind:'ping',time:Date.now()}));},3000);
    };
    channel.onmessage=event=>{
      let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data?.kind==='ping'&&Number.isFinite(data.time))channel.send(JSON.stringify({kind:'pong',time:data.time}));
      if(data?.kind==='pong'&&Number.isFinite(data.time))this.changed('RTC 診斷 '+id.slice(0,5)+'：'+Math.max(0,Date.now()-data.time)+' ms；遊戲仍以伺服器為準。');
    };
    channel.onclose=()=>{if(peer.timer)clearInterval(peer.timer);peer.timer=null;};
  }
  async handle(from,payload){
    if(!this.enabled||!this.ready.has(from)||!payload||typeof payload!=='object')return;
    if(!this.peers.has(from))this.ensure(from);
    const peer=this.peers.get(from),pc=peer?.connection;if(!pc)return;
    try{
      if(payload.type==='offer'){
        if(typeof payload.sdp!=='string'||payload.sdp.length>8000)return;
        await pc.setRemoteDescription({type:'offer',sdp:payload.sdp});
        const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
        this.signal(from,{type:'answer',sdp:pc.localDescription.sdp});
        for(const item of peer.candidates.splice(0))await pc.addIceCandidate(item);
      }else if(payload.type==='answer'){
        if(typeof payload.sdp!=='string'||payload.sdp.length>8000)return;
        await pc.setRemoteDescription({type:'answer',sdp:payload.sdp});
        for(const item of peer.candidates.splice(0))await pc.addIceCandidate(item);
      }else if(payload.type==='candidate'&&payload.candidate&&typeof payload.candidate.candidate==='string'){
        if(!pc.remoteDescription)peer.candidates.push(payload.candidate);
        else await pc.addIceCandidate(payload.candidate);
      }
    }catch{this.changed('WebRTC 協商未成功，仍可正常使用 WebSocket。');}
  }
}
