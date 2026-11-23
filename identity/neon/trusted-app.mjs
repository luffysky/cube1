import { createHash, timingSafeEqual } from 'node:crypto';
import { ISSUER, validateJwk } from '../authority.mjs';

const originAllowed = 'https://games.snowrealm.pet';
const common = {
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains'
};
const json=(status,data,headers={})=>new Response(JSON.stringify(data),{status,headers:{...common,...headers}});
/** Read-only Identity surface until the server owns the consent transaction.
 * Browser input cannot authorize a link or enable token issuance. */
export function createTrustedIdentityApp({authority,verifyToken,dbReady,clientSecret,browserAuthorization,brickduelSync,issuer=ISSUER,issueAdminToken,exchangeCode,adminServiceSecret,adminPublicKeys=[],allowedOrigin=originAllowed}={}){
  if(!authority||typeof verifyToken!=='function'||typeof dbReady!=='function')
    throw Error('identity_app_configuration_missing');
  const playerKeys=authority.publicJwks().keys;
  const adminKeys=adminPublicKeys.map(validateJwk);
  const allKeys=[...playerKeys,...adminKeys];
  if(new Set(allKeys.map(key=>key.kid)).size!==allKeys.length||
     new Set(allKeys.map(key=>key.x)).size!==allKeys.length)
    throw Error('identity_jwks_overlap');
  const hash=value=>createHash('sha256').update(value).digest();
  const clientDigest=typeof clientSecret==='string'&&clientSecret.length>=32
    ? hash(clientSecret) : null;
  const adminDigest=typeof adminServiceSecret==='string'&&adminServiceSecret.length>=32
    ? hash(adminServiceSecret) : null;
  if(adminDigest&&clientDigest&&timingSafeEqual(adminDigest,clientDigest))throw Error('identity_service_secret_overlap');
  const cors=req=>{
    const origin=req.headers.get('origin');
    return origin===allowedOrigin?{
      'Access-Control-Allow-Origin':allowedOrigin,
      'Vary':'Origin'
    }:{'Vary':'Origin'};
  };
  return {
    async fetch(request){
      const path=new URL(request.url).pathname;
      const origin=request.headers.get('origin');
      const headers=cors(request);
      try{
        const save = /^\/v1\/games\/brickduel\/saves\/([^/]+)$/.exec(path);
        if(save&&brickduelSync)return await brickduelSync(request,save[1]);
        if(path==='/oauth/authorize'&&browserAuthorization)return await browserAuthorization(request);
        if(origin&&origin!==allowedOrigin)return json(403,{error:'origin_denied'},headers);
        if(request.method==='GET'&&path==='/.well-known/jwks.json'){
          return json(200,authority.publicJwks(),{'Cache-Control':'public, max-age=60'});
        }
        if(request.method==='GET'&&path==='/.well-known/admin-jwks.json'){
          if(!adminKeys.length)return json(503,{error:'admin_jwks_unavailable'});
          return json(200,{keys:adminKeys},{'Cache-Control':'public, max-age=60'});
        }
        if(request.method==='POST'&&path==='/internal/admin-token'){
          if(!adminDigest||!issueAdminToken)return json(404,{error:'not_found'});
          const presented=request.headers.get('x-snowrealm-admin-service-secret');
          if(origin||!presented||presented.length>512||!timingSafeEqual(hash(presented),adminDigest))
            return json(401,{error:'unauthorized'});
          try {
            const {token}=await issueAdminToken();
            return json(200,{access_token:token,token_type:'Bearer',expires_in:300});
          }catch{return json(503,{error:'admin_signing_unavailable'});}
        }
        if(request.method==='GET'&&path==='/health/live'){
          return json(200,{service:'snowrealm-identity',issuer,
            authorizationAvailable:false,
            crossGameLinkingAvailable:false});
        }
        if(request.method==='GET'&&path==='/health/ready'){
          const databaseReady=await dbReady()===true;
          return json(503,{ready:false,databaseReady,brickduelBffReady:false});
        }
        if(request.method==='POST'&&path==='/oauth/authorize')
          return json(503,{error:'authorization_unavailable'},headers);
        if(request.method==='POST'&&path==='/oauth/token'){
          if(!exchangeCode||!clientDigest)return json(503,{error:'authorization_unavailable'});
          const presented=request.headers.get('x-snowrealm-client-secret');
          if(origin||!presented||presented.length>512||!timingSafeEqual(hash(presented),clientDigest))
            return json(401,{error:'invalid_client'});
          if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')
            return json(415,{error:'invalid_request'});
          const reader=request.body?.getReader();
          if(!reader)return json(400,{error:'invalid_request'});
          const parts=[];
          let size=0;
          for(;;){
            const {done,value}=await reader.read();
            if(done)break;
            size+=value.byteLength;
            if(size>4096){void reader.cancel().catch(()=>{});return json(413,{error:'invalid_request'});}
            parts.push(value);
          }
          let grant;
          try {grant=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return json(400,{error:'invalid_request'});}
          const fields=['clientId','redirectUri','code','codeVerifier','state','nonce'];
          if(!grant||Object.keys(grant).length!==fields.length||fields.some(field=>
            !Object.hasOwn(grant,field)||typeof grant[field]!=='string'))
            return json(400,{error:'invalid_request'});
          try {return json(200,await exchangeCode(grant));}
          catch(error){
            if([400,403].includes(error?.status))return json(400,{error:'invalid_grant'});
            return json(503,{error:'authorization_unavailable'});
          }
        }
        if(request.method==='POST'&&path==='/v1/token/status'){
          if(!clientDigest)return json(503,{active:false});
          const presented=request.headers.get('x-snowrealm-client-secret');
          if(origin||!presented||presented.length>512||!timingSafeEqual(hash(presented),clientDigest))
            return json(401,{active:false});
          const auth=request.headers.get('authorization');
          if(typeof auth!=='string'||auth.length>4096||!/^Bearer [A-Za-z0-9._-]+$/.test(auth))
            return json(401,{active:false});
          try {
            await verifyToken(auth.slice(7));
            return json(200,{active:true});
          }catch {return json(401,{active:false});}
        }
        return json(404,{error:'not_found'});
      } catch(e){
        return json(500,{error:'identity_unavailable'},headers);
      }
    }
  };
}
