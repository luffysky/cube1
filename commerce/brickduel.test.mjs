import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {createBrickduelCommerceSender} from './brickduel.mjs';

test('staging retries preserve the event and sign each delivery with a fresh jti',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const attempts=[];
 const sender=createBrickduelCommerceSender({
  environment:'staging',privateKeyPem:privateKey.export({format:'pem',type:'pkcs8'}),kid:'commerce-staging-test',
  fetchImpl:async(url,request)=>{
   assert.equal(url,'https://brickduel-staging.snowrealm.pet/internal/entitlements/v1/events');
   assert.equal(request.redirect,'error');
   assert.equal(Object.hasOwn(request.headers,'Origin'),false);
   const [header,claims,signature]=request.headers.Authorization.slice(7).split('.');
   assert.equal(verify(null,Buffer.from(header+'.'+claims),publicKey,Buffer.from(signature,'base64url')),true);
   attempts.push({claims:JSON.parse(Buffer.from(claims,'base64url')),body:request.body});
   return attempts.length===1 ? new Response(null,{status:503}) : Response.json({result:'duplicate'});
  },
 });
 const event={eventId:'b44f6de4-3fe5-4fc9-94ca-1b96c4fffe0d',version:1};
 assert.deepEqual(await sender.deliver(event),{status:'retry',httpStatus:503});
 assert.deepEqual(await sender.deliver(event),{status:'delivered',result:'duplicate'});
 assert.equal(attempts.length,2);
 assert.notEqual(attempts[0].claims.jti,attempts[1].claims.jti);
 assert.equal(attempts[0].body,attempts[1].body);
 const jwt=attempts[0].claims;
 assert.equal(jwt.iss,'https://identity-staging.snowrealm.pet');
 assert.equal(jwt.aud,'snowrealm:brickduel:entitlements');
 assert.equal(jwt.sub,'svc:snowrealm-commerce');
 assert.equal(jwt.scope,'entitlements:write');
 assert.equal(jwt.exp-jwt.iat,300);
 assert.equal(Object.hasOwn(sender.publicJwks().keys[0],'d'),false);
});
