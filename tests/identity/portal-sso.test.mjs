import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePortalSsoIntent,BRICKDUEL_CALLBACK} from '../../dist/sso-flow.mjs';
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
