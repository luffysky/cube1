import {createRemoteJWKSet,jwtVerify} from 'jose';
import {pageRoutes} from './routes.mjs';

const apiOrigin='https://br-winter-thunder-b3ozovl2-cube1api.compute.c-4.ap-southeast-1.aws.neon.tech';
const adminReads=new Set(['overview','trends','players','ledger','matches']
 .map(name=>'v1/admin/'+name));
const ownerPaths=new Map([
 ['v1/admin/owner/suspension','POST'],['v1/admin/owner/coins','POST'],
 ['v1/admin/owner/match-correction','POST'],['v1/admin/owner/audit','GET']
]);
const jwksByIssuer=new Map();

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  const {ACCESS_ISSUER:issuer,ACCESS_AUDIENCE:audience,ADMIN_ENTRY_PATH:entry}=env;
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
   'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, noarchive'};
  const deny=(status,extra={})=>new Response(null,{status,headers:{...headers,...extra}});
  if(url.origin!=='https://games.snowrealm.pet'||!audience||
     !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer??'')||
     !/^\/srg-console-[A-Za-z0-9_-]{24,80}\/$/.test(entry??''))return deny(403);
  const token=request.headers.get('cf-access-jwt-assertion');
  if(!token||token.length>8192)return deny(403);
  try{
   if(!jwksByIssuer.has(issuer))jwksByIssuer.set(issuer,
    createRemoteJWKSet(new URL('/cdn-cgi/access/certs',issuer)));
   await jwtVerify(token,jwksByIssuer.get(issuer),{
    issuer,audience,algorithms:['RS256'],requiredClaims:['exp','sub','email']
   });
  }catch{return deny(403);}
  if(!url.pathname.startsWith(entry))return deny(404);
  const asset=url.pathname.slice(entry.length)||'index.html';
  if(adminReads.has(asset)||ownerPaths.has(asset)){
   const method=ownerPaths.get(asset)??'GET';
   if(request.method!==method)return deny(405,{Allow:method});
   const authorization=request.headers.get('authorization');
   if(!authorization||authorization.length>16384||!/^Bearer [^\s]+$/.test(authorization))
    return deny(401);
   try{
    const upstreamHeaders=new Headers({Authorization:authorization,Accept:'application/json'});
    let body;
    if(ownerPaths.has(asset)){
     const proof=env.SNOWREALM_OWNER_GATEWAY_SECRET;
     if(typeof proof!=='string'||proof.length<32)return deny(503);
     upstreamHeaders.set('X-SnowRealm-Owner-Gateway',proof);
     if(method==='POST'){
      if(request.headers.get('origin')!==url.origin)return deny(403);
      const key=request.headers.get('idempotency-key');
      if(!key||!/^[-\w:.]{8,100}$/.test(key))return deny(400);
      if(!request.headers.get('content-type')?.startsWith('application/json'))return deny(415);
      const reader=request.body?.getReader();
      if(!reader)return deny(400);
      const parts=[];let size=0;
      while(true){
       const {done,value}=await reader.read();
       if(done)break;
       size+=value.byteLength;
       if(size>4096){await reader.cancel();return deny(413);}
       parts.push(value);
      }
      body=new Blob(parts,{type:'application/json'});
      upstreamHeaders.set('Content-Type','application/json');
      upstreamHeaders.set('Idempotency-Key',key);
     }
    }
    const upstream=await fetch(new URL('/'+asset,apiOrigin).href,{
     method,...(body===undefined?{}:{body}),headers:upstreamHeaders,redirect:'manual'
    });
    if(upstream.status>=300&&upstream.status<400){
     console.warn('admin_upstream_redirect',{status:upstream.status});
     return deny(502,{'X-SnowRealm-Admin-Error':'upstream_redirect'});
    }
    return new Response(upstream.body,{status:upstream.status,
     headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
   }catch(error){
    console.warn('admin_upstream_failure',{kind:error instanceof TypeError?'type_error':'request_error'});
    return deny(502,{'X-SnowRealm-Admin-Error':'upstream_request_failed'});
   }
  }
  const isPage=asset==='index.html'||pageRoutes.has(asset);
  if(!isPage&&!['admin.mjs','admin.css','realm-mark.svg'].includes(asset))return deny(404);
  if(!['GET','HEAD'].includes(request.method))return deny(405,{Allow:'GET, HEAD'});
  const response=await env.ASSETS.fetch(new Request(new URL(isPage?'/index.html':'/'+asset,url),{method:request.method}));
  const result=new Headers(response.headers);
  for(const [key,value] of Object.entries(headers))result.set(key,value);
  const outgoing=new Response(response.body,{status:response.status,headers:result});
  if(!isPage||request.method==='HEAD'||!response.ok)return outgoing;
  return new HTMLRewriter().on('head',{
   element(head){head.prepend('<base href="'+entry+'">',{html:true});}
  }).transform(outgoing);
 }
};
