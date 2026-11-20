import { createPrivateKey, createPublicKey } from 'node:crypto';

const ISSUER = 'https://identity.snowrealm.pet';
const KID = /^[A-Za-z0-9_-]{8,80}$/;
const security = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store'
};
const respond=(status,body,extra={})=>new Response(JSON.stringify(body),{
  status, headers:{...security,...extra}
});

// Strictly public read-only Identity surface.
// No bearer token login, code exchange, refresh, admin, or minting route is exposed.
export function createPublicHandler({privateKeyBase64,kid}={}){
  if(typeof privateKeyBase64!=='string'||privateKeyBase64.length<60||
     !KID.test(kid||''))throw Error('identity_signing_configuration_missing');
  let key;
  try {key=createPrivateKey({key:Buffer.from(privateKeyBase64,'base64'),format:'der',type:'pkcs8'});}
  catch {throw Error('identity_signing_configuration_invalid');}
  if(key.asymmetricKeyType!=='ed25519')throw Error('identity_signing_configuration_invalid');
  const jwk=createPublicKey(key).export({format:'jwk'});
  const publicKey=Object.freeze({kty:'OKP',crv:'Ed25519',x:jwk.x,kid,use:'sig',alg:'EdDSA'});
  return {
    async fetch(request){
      const path=new URL(request.url).pathname;
      if(request.method==='GET'&&path==='/.well-known/jwks.json')
        return respond(200,{keys:[publicKey]},{'Cache-Control':'public, max-age=60'});
      if(request.method==='GET'&&path==='/health/live')
        return respond(200,{service:'snowrealm-identity',issuer:ISSUER,phase:'jwks-foundation',
          authorizationAvailable:false,linkEnabled:false});
      if(request.method==='GET'&&path==='/health/ready')
        return respond(503,{ready:false,reason:'oauth_bff_revocation_not_live'});
      return respond(404,{error:'route_not_found'});
    }
  };
}

let app;
export default {
  async fetch(request){
    try {
      app??=createPublicHandler({
        privateKeyBase64:process.env.IDENTITY_ED25519_PKCS8_BASE64,
        kid:process.env.IDENTITY_ACTIVE_KID
      });
      return app.fetch(request);
    } catch {
      // Never log secrets, PEMs, incoming cookies or bearer tokens.
      return respond(503,{error:'identity_signing_unavailable'});
    }
  }
};
