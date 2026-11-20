import { timingSafeEqual } from 'node:crypto';
import { ISSUER } from '../authority.mjs';

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
function equals(a,b){
  if(typeof a!=='string'||typeof b!=='string'||!b||a.length!==b.length)return false;
  return timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
async function readJson(req){
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw Object.assign(Error('invalid_content_type'),{status:415});
  const raw=await req.text();
  if(raw.length>4096)throw Object.assign(Error('request_too_large'),{status:413});
  try{const o=JSON.parse(raw);if(!o||Array.isArray(o)||typeof o!=='object')throw Error();return o;}
  catch{throw Object.assign(Error('invalid_json'),{status:400});}
}

/** Public Node fetch handler. Every privileged service injected from trusted server
 * dependencies, never from a browser request. No admin mutation routes.
 * Browser authorization is delegated to an already verified Neon Bearer JWT,
 * not a guessed cookie or email. This is an API authorization adapter,
 * not yet an entire interactive OIDC provider or Brickduel BFF. */
export function createTrustedIdentityApp({authority,authenticate,oauth,verifyToken,
  dbReady,clientSecret,allowedOrigin=originAllowed}={}){
  if(!authority||typeof authenticate!=='function'||!oauth||
     typeof verifyToken!=='function'||typeof dbReady!=='function')
     throw Error('identity_app_configuration_missing');
  const cors=req=>{
    const origin=req.headers.get('origin');
    return origin===allowedOrigin?{
      'Access-Control-Allow-Origin':allowedOrigin,
      'Access-Control-Allow-Headers':'Authorization,Content-Type',
      'Access-Control-Allow-Methods':'POST,OPTIONS',
      'Vary':'Origin'
    }:{'Vary':'Origin'};
  };
  return {
    async fetch(request){
      const path=new URL(request.url).pathname;
      const origin=request.headers.get('origin');
      const headers=cors(request);
      try{
        if(origin&&origin!==allowedOrigin)return json(403,{error:'origin_denied'},headers);
        if(request.method==='OPTIONS'&&path==='/oauth/authorize'&&origin===allowedOrigin)
          return new Response(null,{status:204,headers:{...headers,'Access-Control-Max-Age':'120'}});
        if(request.method==='GET'&&path==='/.well-known/jwks.json'){
          return json(200,authority.publicJwks(),{'Cache-Control':'public, max-age=60'});
        }
        if(request.method==='GET'&&path==='/health/live'){
          return json(200,{service:'snowrealm-identity',issuer:ISSUER,
            authorizationAvailable:Boolean(clientSecret?.length>=32),
            crossGameLinkingAvailable:false});
        }
        if(request.method==='GET'&&path==='/health/ready'){
          const ready=typeof clientSecret==='string'&&clientSecret.length>=32&&await dbReady()===true;
          return json(ready?200:503,{ready,brickduelBffReady:false});
        }
        if(request.method==='POST'&&path==='/oauth/authorize'){
          const subject=await authenticate(request);
          if(typeof subject!=='string'||subject.length<8) return json(401,{error:'login_required'},headers);
          if(origin!==allowedOrigin)return json(403,{error:'origin_denied'},headers);
          const data=await readJson(request);
          // User confirmation must be a deliberate UI action from the exact
          // allowed origin; no session/token is accepted from query parameters.
          if(data.consent!==true)return json(403,{error:'consent_required'},headers);
          const authorized=await oauth.authorize({
            verifiedSubject:subject,consentGranted:true,clientId:data.clientId,
            redirectUri:data.redirectUri,codeChallenge:data.codeChallenge,
            state:data.state,nonce:data.nonce
          });
          return json(200,authorized,headers);
        }
        if(request.method==='POST'&&path==='/oauth/token'){
          if(typeof clientSecret!=='string'||clientSecret.length<32)
            return json(503,{error:'client_auth_unavailable'});
          if(!equals(request.headers.get('x-snowrealm-client-secret'),clientSecret))
            return json(401,{error:'invalid_client'});
          const data=await readJson(request);
          const token=await oauth.exchange({clientId:data.clientId,redirectUri:data.redirectUri,
            code:data.code,codeVerifier:data.codeVerifier,state:data.state,nonce:data.nonce});
          return json(200,token);
        }
        if(request.method==='POST'&&path==='/v1/token/status'){
          const auth=request.headers.get('authorization');
          if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9._-]+$/.test(auth))
            return json(401,{active:false});
          try {
            const checked=await verifyToken(auth.slice(7));
            return json(200,{active:true,playerId:checked.playerId});
          }catch {return json(401,{active:false});}
        }
        return json(404,{error:'not_found'});
      } catch(e){
        // No user input, tokens, headers or SQL errors are ever logged.
        const status=[400,401,403,413,415].includes(e?.status)?e.status:500;
        return json(status,{error:status===500?'identity_unavailable':e.message},headers);
      }
    }
  };
}
