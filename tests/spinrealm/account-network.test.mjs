import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const microtasks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function rankedClass(onSubscribe){
  const key=`__rankIdentity${crypto.randomUUID().replaceAll('-','')}`;
  globalThis[key]={onSubscribe};
  const source=(await readFile(new URL('../../dist/games/spinrealm/ranked-client.mjs',import.meta.url),'utf8')).replace("import { api, memberState, subscribeMember } from './member-client.mjs';",`const api=()=>{throw new Error('Inject test transport');};const memberState=()=>({user:{id:'alice'}});const subscribeMember=fn=>{globalThis['${key}']?.onSubscribe?.(fn);delete globalThis['${key}'];return()=>{};};`);
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${crypto.randomUUID()}`)).RankedClient;
}
const snapshot=(accepted=0,applied=0,tick=0,id='match-one')=>({id,status:'running',you:'alice',tick,countdownMs:0,lastAcceptedSeq:{alice:accepted},lastAppliedSeq:{alice:applied}});
function timerFixture(){let time=1000,next=1;const timers=new Map();return{now:()=>time,advance:ms=>{time+=ms;},schedule:(fn,delay)=>{const id=next++;timers.set(id,{fn,delay});return id;},cancel:id=>timers.delete(id),timers};}

test('ranked keeps received-but-not-applied inputs for prediction and never resends accepted commands',async()=>{
  const RankedClient=await rankedClass(),clock=timerFixture(),requests=[];
  const client=new RankedClient({...clock,request:async(path,options)=>{requests.push({path,options});return snapshot(1,0,0);}});
  client.matchId='match-one';client.acceptSnapshot(snapshot());
  assert.equal(client.input('left'),true);await client.flush();
  assert.equal(client.pending.length,1);assert.equal(client.lastAccepted,1);
  clock.advance(100);await client.flush();assert.equal(requests.length,1);
  client.acceptSnapshot(snapshot(1,1,1));assert.equal(client.pending.length,0);
  client.clearTimers();
});

test('ranked batches at no more than ten requests per second and honors retry delay',async()=>{
  const RankedClient=await rankedClass(),clock=timerFixture();let requests=0,fail=false;
  const client=new RankedClient({...clock,request:async(path,options)=>{
    requests++;if(fail){const error=new Error('limited');error.status=429;error.details={retryAfter:2};throw error;}
    const seq=options.body.inputs.at(-1).seq;return snapshot(seq,seq,seq);
  }});
  client.matchId='match-one';client.acceptSnapshot(snapshot());client.input('left');await client.flush();
  client.input('right');clock.advance(50);await client.flush();assert.equal(requests,1);
  clock.advance(50);await client.flush();assert.equal(requests,2);
  fail=true;client.input('cw');clock.advance(100);await client.flush();assert.equal(requests,3);
  clock.advance(1000);await client.flush();assert.equal(requests,3);
  clock.advance(1000);fail=false;await client.flush();assert.equal(requests,4);
  client.clearTimers();
});

test('queue cancellation waits for join, sends JSON, and stale queued responses cannot rejoin',async()=>{
  const RankedClient=await rankedClass(),clock=timerFixture(),joinReply=deferred(),requests=[];
  const client=new RankedClient({...clock,request:async(path,options)=>{requests.push({path,options});return options.method==='POST'?joinReply.promise:{status:'idle'};}});
  const joining=client.join();await microtasks();const leaving=client.leave();await microtasks();
  assert.equal(requests.length,1);assert.equal(requests[0].options.method,'POST');
  joinReply.resolve({status:'queued',pollAfterMs:2000});await Promise.all([joining,leaving]);
  assert.equal(requests.length,2);assert.equal(requests[1].options.method,'DELETE');assert.deepEqual(requests[1].options.body,{});
  assert.equal(client.queued,false);assert.equal(client.closed,true);assert.equal(clock.timers.size,0);
});

test('idle queue stops polling; responses from an old match cannot overwrite a new one',async()=>{
  const RankedClient=await rankedClass(),clock=timerFixture(),reply=deferred();
  const client=new RankedClient({...clock,request:async()=>reply.promise});
  client.queued=true;client.acceptQueue({status:'idle'});assert.equal(client.queued,false);assert.equal(clock.timers.size,0);
  client.matchId='match-one';client.acceptSnapshot(snapshot());client.input('left');const sending=client.flush();await microtasks();
  client.acceptSnapshot({...snapshot(0,0,1),status:'ended'});
  client.closed=false;client.matchId='match-two';client.hasSnapshot=true;client.sending=true;client.pending=[{seq:1,action:'right'}];
  reply.resolve(snapshot(1,1,2));await sending;
  assert.equal(client.matchId,'match-two');assert.equal(client.sending,true);assert.deepEqual(client.pending,[{seq:1,action:'right'}]);client.clearTimers();
});

test('logout disables ranked inputs and ignores a pending server response',async()=>{
  let notifyIdentity;const RankedClient=await rankedClass(fn=>{notifyIdentity=fn;}),clock=timerFixture(),reply=deferred();
  const events=[];const client=new RankedClient({...clock,request:async()=>reply.promise,onQueue:event=>events.push(event)});
  client.matchId='match-one';client.acceptSnapshot(snapshot());client.input('left');const sending=client.flush();await microtasks();
  notifyIdentity({user:null});assert.equal(client.matchId,null);assert.equal(client.input('hard'),false);assert.equal(client.pending.length,0);
  reply.resolve(snapshot(1,1,1));await sending;assert.equal(client.closed,true);assert.equal(client.matchId,null);assert.equal(clock.timers.size,0);
  assert.equal(events.at(-1).reason,'session_changed');
});

async function memberModule(t,{fetcher,sessionToken}={}){
  const key=`__memberTest${crypto.randomUUID().replaceAll('-','')}`,oldFetch=globalThis.fetch;
  let tokenCalls=0;const entitlements=[];
  const profile={profile:{id:'alice'},wallet:{balance:250},appearance:{theme:'obsidian'},entitlement:{plus:false,customImages:false}};
  const signed=`e30.${Buffer.from(JSON.stringify({sub:'alice',exp:Math.floor(Date.now()/1000)+900})).toString('base64url')}.test`;
  const env={CONFIG:{authUrl:'https://auth.example',apiUrl:'https://api.example'},setEntitlements:value=>entitlements.push(value),setAppearance:()=>{},restoreCustomImage:async()=>{},clearCustomPreview:()=>{},setImageScope:()=>{},auth:{getSession:async()=>{tokenCalls++;return{data:{user:{id:'alice'},session:{token:sessionToken??signed}}};},signOut:async()=>({data:{}})}};
  globalThis[key]=env;globalThis.fetch=fetcher||(async()=>Response.json(profile));
  let source=await readFile(new URL('../../dist/games/spinrealm/member-client.mjs',import.meta.url),'utf8');
  source=source.replace("import { CONFIG } from './config.mjs';",`const {CONFIG}=globalThis['${key}'];`)
    .replace("import { setEntitlements, setAppearance, restoreCustomImage, clearCustomPreview, setImageScope } from './appearance.mjs';",`const {setEntitlements,setAppearance,restoreCustomImage,clearCustomPreview,setImageScope}=globalThis['${key}'];`)
    .replace("import('./vendor/neon-auth.mjs')",`Promise.resolve({createAuthClient:()=>globalThis['${key}'].auth})`);
  const module=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${key}`);
  t.after(()=>{globalThis.fetch=oldFetch;delete globalThis[key];});
  return{module,profile,entitlements,tokenCalls:()=>Math.max(0,tokenCalls-1),setFetch:value=>{globalThis.fetch=value;}};
}

test('member caches JWT across polls and refreshes once after 401',async t=>{
  const fixture=await memberModule(t);await fixture.module.initMember();
  for(let i=0;i<5;i++)await fixture.module.api('/v1/profile');assert.equal(fixture.tokenCalls(),1);
  let attempts=0;fixture.setFetch(async()=>++attempts===1?Response.json({error:{code:'unauthorized'}},{status:401}):Response.json(fixture.profile));
  await fixture.module.api('/v1/profile');assert.equal(attempts,2);assert.equal(fixture.tokenCalls(),2);
});

test('a committed purchase stays successful when profile refresh fails',async t=>{
  const fixture=await memberModule(t);await fixture.module.initMember();let purchases=0;
  fixture.setFetch(async url=>{if(url.endsWith('/purchase')){purchases++;return Response.json({purchased:{itemId:'shield'},wallet:{balance:230}});}throw new TypeError('connection lost');});
  const receipt=await fixture.module.economyAction('/v1/shop/purchase',{itemId:'shield'});
  assert.equal(receipt.wallet.balance,230);assert.equal(purchases,1);assert.equal(fixture.module.memberState().error,'network_error');
});

test('uncertain mutation retries keep one idempotency key',async t=>{
  const fixture=await memberModule(t);await fixture.module.initMember();const keys=[];let failure=true;
  fixture.setFetch(async(url,options)=>{
    if(url.endsWith('/purchase')){keys.push(options.headers['Idempotency-Key']);if(failure){failure=false;throw new TypeError('lost response');}return Response.json({wallet:{balance:230}});}
    return Response.json(fixture.profile);
  });
  await assert.rejects(fixture.module.economyAction('/v1/shop/purchase',{itemId:'shield'}));
  await fixture.module.economyAction('/v1/shop/purchase',{itemId:'shield'});assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);
});

test('late profile response cannot restore membership after sign-out',async t=>{
  const fixture=await memberModule(t);await fixture.module.initMember();const reply=deferred();
  fixture.setFetch(async()=>reply.promise);const pending=fixture.module.refreshProfile();await microtasks();
  await fixture.module.signOut();reply.resolve(Response.json({...fixture.profile,entitlement:{plus:true,customImages:true}}));
  assert.equal(await pending,null);assert.equal(fixture.module.memberState().user,null);assert.equal(fixture.module.memberState().profile,null);
  assert.deepEqual(fixture.entitlements.at(-1),{customImages:false});
});


test('opaque session token falls back to Better Auth JWT endpoint but never sends opaque credentials to game API',async t=>{
  const calls=[];
  const signed='e30.'+Buffer.from(JSON.stringify({sub:'alice',exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.sig';
  const fixture=await memberModule(t,{sessionToken:'opaque-session-value',fetcher:async(url,options)=>{
    calls.push({url,options});
    if(url==='https://auth.example/token')return Response.json({token:signed});
    return Response.json(fixture.profile);
  }});
  await fixture.module.initMember();
  assert.equal(fixture.module.memberState().profile?.profile?.id,'alice');
  assert.equal(calls.filter(c=>c.url==='https://auth.example/token').length,1);
  const apiRequest=calls.find(c=>c.url==='https://api.example/v1/profile');
  assert.equal(apiRequest?.options?.headers?.Authorization,'Bearer '+signed);
  assert.equal(calls.find(c=>c.url==='https://auth.example/token').options.credentials,'include');
});

test('opaque session token is rejected when Better Auth JWT endpoint is unavailable',async t=>{
  const calls=[];
  const fixture=await memberModule(t,{sessionToken:'opaque-session-value',fetcher:async(url)=>{
    calls.push(url);
    if(url==='https://auth.example/token')return Response.json({error:'no token'},{status:404});
    return Response.json({});
  }});
  await fixture.module.initMember();
  await assert.rejects(fixture.module.api('/v1/profile'),{code:'session_token_unavailable'});
  assert.equal(calls.some(url=>url.startsWith('https://api.example/')),false);
});


test('profile fetch failures never present invented Free/1000/Silver account data',async()=>{
 const source=await readFile(new URL('../../dist/games/spinrealm/member-ui.mjs',import.meta.url),'utf8');
 const from=source.indexOf('function renderAccount(){');
 const to=source.indexOf('function renderCoinReward()',from);
 assert.ok(from>=0&&to>from);
 const section=source.slice(from,to);
 assert.match(section,/if\(!p\)\{/);
 assert.match(section,/account\.profileUnavailable/);
 assert.match(section,/common\.retry/);
 assert.ok(section.indexOf('if(!p){') < section.indexOf('subscription.free'), 'must show retry before rendering any entitlement fallback');
 assert.ok(section.indexOf('if(!p){') < section.indexOf('ranked.rating'), 'must show retry before rendering any rating fallback');
});
