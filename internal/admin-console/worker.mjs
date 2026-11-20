import {createRemoteJWKSet,jwtVerify} from 'jose';

const apiOrigin='https://br-winter-thunder-b3ozovl2-cube1api.compute.c-4.ap-southeast-1.aws.neon.tech';
const adminReads=new Set(['overview','trends','players','ledger','matches']
 .map(name=>'v1/admin/'+name));
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
  if(!['GET','HEAD'].includes(request.method))return deny(405,{Allow:'GET, HEAD'});
  if(!url.pathname.startsWith(entry))return deny(404);
  const asset=url.pathname.slice(entry.length)||'index.html';
  if(adminReads.has(asset)){
   if(request.method!=='GET')return deny(405,{Allow:'GET'});
   const authorization=request.headers.get('authorization');
   if(!authorization||authorization.length>16384||!/^Bearer [^\s]+$/.test(authorization))
    return deny(401);
   try{
    const upstream=await fetch(new URL('/'+asset,apiOrigin),{
     headers:{Authorization:authorization,Accept:'application/json'},redirect:'error'
    });
    return new Response(upstream.body,{status:upstream.status,
     headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
   }catch{return deny(502);}
  }
  if(!['index.html','admin.mjs','admin.css','realm-mark.svg'].includes(asset))return deny(404);
  const response=await env.ASSETS.fetch(new Request(new URL('/'+asset,url),{method:request.method}));
  const result=new Headers(response.headers);
  for(const [key,value] of Object.entries(headers))result.set(key,value);
  return new Response(response.body,{status:response.status,headers:result});
 }
};
