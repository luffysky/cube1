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
/** Read-only Identity surface until the server owns the consent transaction.
 * Browser input cannot authorize a link or enable token issuance. */
export function createTrustedIdentityApp({authority,verifyToken,dbReady,allowedOrigin=originAllowed}={}){
  if(!authority||typeof verifyToken!=='function'||typeof dbReady!=='function')
    throw Error('identity_app_configuration_missing');
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
        if(origin&&origin!==allowedOrigin)return json(403,{error:'origin_denied'},headers);
        if(request.method==='GET'&&path==='/.well-known/jwks.json'){
          return json(200,authority.publicJwks(),{'Cache-Control':'public, max-age=60'});
        }
        if(request.method==='GET'&&path==='/health/live'){
          return json(200,{service:'snowrealm-identity',issuer:ISSUER,
            authorizationAvailable:false,
            crossGameLinkingAvailable:false});
        }
        if(request.method==='GET'&&path==='/health/ready'){
          const databaseReady=await dbReady()===true;
          return json(503,{ready:false,databaseReady,brickduelBffReady:false});
        }
        if(request.method==='POST'&&(path==='/oauth/authorize'||path==='/oauth/token')){
          return json(503,{error:'authorization_unavailable'},headers);
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
        return json(500,{error:'identity_unavailable'},headers);
      }
    }
  };
}
