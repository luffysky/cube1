import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePortalSsoIntent,BRICKDUEL_CALLBACK,loadPortalSsoIntent,clearPortalSsoIntent} from '../../dist/sso-flow.mjs';
const url=({client_id='brickduel-bff',redirect_uri=BRICKDUEL_CALLBACK,
  state='s'.repeat(43),nonce='n'.repeat(43),code_challenge='a'.repeat(43),
  code_challenge_method='S256',sso='brickduel'}={})=>{
 const u=new URL('https://games.snowrealm.pet/');
 for(const [key,value] of Object.entries({client_id,redirect_uri,state,nonce,code_challenge,code_challenge_method,sso}))u.searchParams.set(key,value);
 return u;
};
test('accept exact approved Brickduel client, callback and PKCE only',()=>{
 const result=parsePortalSsoIntent(url().href);
 assert.equal(result.clientId,'brickduel-bff');
 assert.equal(result.redirectUri,BRICKDUEL_CALLBACK);
 assert.equal(result.state.length,43);
});
test('reject arbitrary callback, weak challenge, wrong method and other client',()=>{
 assert.equal(parsePortalSsoIntent(url({redirect_uri:'https://evil.test/cb'}).href),null);
 assert.equal(parsePortalSsoIntent(url({code_challenge:'a'}).href),null);
 assert.equal(parsePortalSsoIntent(url({code_challenge_method:'plain'}).href),null);
 assert.equal(parsePortalSsoIntent(url({client_id:'attacker'}).href),null);
});
test('never accept tokens in URL, even on valid callback',()=>{
 const u=url();u.searchParams.set('access_token','leak');
 assert.equal(parsePortalSsoIntent(u.href),null);
 assert.equal(parsePortalSsoIntent('https://evil.test/?sso=brickduel'),null);
});

const memoryStorage=()=>{
 const entries=new Map();
 return {setItem:(key,value)=>entries.set(key,value),getItem:key=>entries.get(key)??null,
  removeItem:key=>entries.delete(key)};
};

test('reload restores the exact intent after URL cleanup without extending its lifetime',()=>{
 const storage=memoryStorage(), now=1000;
 const incoming=url();incoming.searchParams.set('lang','ja');incoming.hash='#games';
 let cleaned;
 const original=loadPortalSsoIntent(incoming.href,{storage,now,replaceUrl:value=>{cleaned=value;}});
 assert.equal(cleaned,'/?lang=ja#games');
 const resumed=loadPortalSsoIntent(new URL(cleaned,'https://games.snowrealm.pet').href,{storage,now:now+1000});
 assert.deepEqual(resumed,original);
 assert.equal(loadPortalSsoIntent('https://games.snowrealm.pet/',{storage,now:original.expiresAt}),null);
});

test('new invalid intent supersedes old state and storage failures keep the incoming URL',()=>{
 const storage=memoryStorage(), now=1000;
 loadPortalSsoIntent(url().href,{storage,now});
 assert.equal(loadPortalSsoIntent('https://games.snowrealm.pet/?sso=brickduel',{storage,now}),null);
 assert.equal(loadPortalSsoIntent('https://games.snowrealm.pet/',{storage,now}),null);
 const blocked={setItem(){throw Error('denied');}};
 let replaced=false;
 assert.ok(loadPortalSsoIntent(url().href,{storage:blocked,now,replaceUrl:()=>{replaced=true;}}));
 assert.equal(replaced,false);
});

test('completion clears the matching intent only',()=>{
 const storage=memoryStorage(),now=1000;
 const original=loadPortalSsoIntent(url().href,{storage,now});
 clearPortalSsoIntent(storage,'another-intent');
 assert.ok(loadPortalSsoIntent('https://games.snowrealm.pet/',{storage,now}));
 clearPortalSsoIntent(storage,original.state);
 assert.equal(loadPortalSsoIntent('https://games.snowrealm.pet/',{storage,now}),null);
});
