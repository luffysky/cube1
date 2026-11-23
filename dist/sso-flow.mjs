export const BRICKDUEL_CALLBACK='https://brickduel.snowrealm.pet/api/auth/callback';
export const BRICKDUEL_CLIENT='brickduel-bff';
const token=/^[A-Za-z0-9._~-]{22,256}$/;
const challenge=/^[A-Za-z0-9_-]{43}$/;

// SSO intent is an untrusted URL. Never accept arbitrary redirects or clients.
export function parsePortalSsoIntent(url){
  const u=new URL(url,'https://games.snowrealm.pet/');
  if(u.origin!=='https://games.snowrealm.pet'||u.searchParams.get('sso')!=='brickduel')return null;
  if(u.searchParams.get('client_id')!==BRICKDUEL_CLIENT||
     u.searchParams.get('redirect_uri')!==BRICKDUEL_CALLBACK||
     u.searchParams.get('code_challenge_method')!=='S256')return null;
  const state=u.searchParams.get('state'),nonce=u.searchParams.get('nonce'),codeChallenge=u.searchParams.get('code_challenge');
  if(!token.test(state||'')||!token.test(nonce||'')||!challenge.test(codeChallenge||''))return null;
  if(u.searchParams.has('code')||u.searchParams.has('access_token')||u.searchParams.has('refresh_token'))return null;
  return {clientId:BRICKDUEL_CLIENT,redirectUri:BRICKDUEL_CALLBACK,
    state,nonce,codeChallenge};
}

const storageKey='snowrealm:brickduel-sso:v1';
const intentLifetime=10*60*1000;
const intentParams=['sso','client_id','redirect_uri','state','nonce','code_challenge','code_challenge_method','response_type'];

function clearIntent(storage){
  try{storage?.removeItem(storageKey);}catch{/* Storage may be unavailable in a private tab. */}
}

export function loadPortalSsoIntent(url,{storage,now=Date.now(),replaceUrl}={}){
  const current=new URL(url);
  if(current.origin!=='https://games.snowrealm.pet')return null;
  try{
    if(intentParams.some(key=>current.searchParams.has(key)) ||
       ['code','access_token','refresh_token'].some(key=>current.searchParams.has(key))){
      const intent=parsePortalSsoIntent(current.href);
      if(!intent){clearIntent(storage);return null;}
      const expiresAt=now+intentLifetime;
      try{
        storage?.setItem(storageKey,JSON.stringify({state:intent.state,nonce:intent.nonce,codeChallenge:intent.codeChallenge,expiresAt}));
        if(storage){
          for(const key of intentParams)current.searchParams.delete(key);
          replaceUrl?.(current.pathname+current.search+current.hash);
        }
      }catch{/* Keep the original URL when the browser disallows storage. */}
      return {...intent,expiresAt};
    }
    const raw=storage?.getItem(storageKey);
    if(!raw || raw.length>1024)return null;
    const saved=JSON.parse(raw);
    if(!Number.isSafeInteger(saved?.expiresAt)||saved.expiresAt<=now||saved.expiresAt>now+intentLifetime||
       typeof saved.state!=='string'||!token.test(saved.state)||
       typeof saved.nonce!=='string'||!token.test(saved.nonce)||
       typeof saved.codeChallenge!=='string'||!challenge.test(saved.codeChallenge)){
      clearIntent(storage);
      return null;
    }
    return {clientId:BRICKDUEL_CLIENT,redirectUri:BRICKDUEL_CALLBACK,state:saved.state,
      nonce:saved.nonce,codeChallenge:saved.codeChallenge,expiresAt:saved.expiresAt};
  }catch{clearIntent(storage);return null;}
}

export function clearPortalSsoIntent(storage,state){
  try{
    const saved=JSON.parse(storage?.getItem(storageKey)??'null');
    if(saved?.state===state)clearIntent(storage);
  }catch{/* A failed cleanup cannot block navigation. */}
}
