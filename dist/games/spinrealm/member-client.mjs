import { CONFIG } from './config.mjs';
import { setEntitlements, setAppearance, restoreCustomImage, clearCustomPreview, setImageScope } from './appearance.mjs';

const listeners = new Set();
let clientPromise, readyPromise, sessionGeneration = 0, cachedToken = null, tokenRequest = null;
let state = { ready:false, user:null, profile:null, error:null, busy:false };
export const memberState = () => state;
export function subscribeMember(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); }
function emit(patch) { state={...state,...patch}; for(const fn of listeners) fn(state); }
export class ServiceError extends Error {
  constructor(code, status=0, details) { super(code); this.code=code; this.status=status; this.details=details; }
}
async function auth() {
  if(!clientPromise) clientPromise=import('./vendor/neon-auth.mjs').then(({createAuthClient})=>createAuthClient(CONFIG.authUrl)).catch(error=>{clientPromise=null;throw error;});
  return clientPromise;
}
function result(result) {
  if(result?.error) throw new ServiceError(result.error.code || 'auth_failed', result.error.status, result.error.message);
  return result?.data;
}
function invalidateSession() { sessionGeneration++; cachedToken=null; tokenRequest=null; return sessionGeneration; }
function sameSession(generation,userId) { return generation===sessionGeneration && state.user?.id===userId; }
function clearLocalMembership() {
  setImageScope(null);clearCustomPreview(); setEntitlements({customImages:false});
  setAppearance({theme:'obsidian',blocks:'classic',board:'grid',background:'solid',customBackgroundEnabled:false});
  emit({user:null,profile:null,error:null});
}
function tokenExpiry(token) {
  try {
    const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if(Number.isFinite(payload.exp))return Math.min(Date.now()+14*60000,payload.exp*1000-60000);
  } catch {}
  return Date.now()+30000;
}
async function accessToken(force=false) {
  const generation=sessionGeneration,userId=state.user?.id;
  if(!userId)throw new ServiceError('sign_in_required',401);
  if(!force&&cachedToken?.userId===userId&&cachedToken.expiresAt>Date.now())return cachedToken.token;
  if(tokenRequest?.generation===generation&&tokenRequest.userId===userId)return tokenRequest.promise;
  const pending={generation,userId,promise:null};
  pending.promise=(async()=>{
    let data=result(await (await auth()).getSession());
    if(!sameSession(generation,userId))throw new ServiceError('session_expired',401);
    // Neon Auth attaches its signed JWT to the get-session response via Set-Auth-Jwt.
    // The SDK injects it into data.session.token; an opaque Better Auth session
    // token is NOT a valid JWT and must never be sent to our game API.
    let token=data?.session?.token;
    if(typeof token!=='string'||token.split('.').length!==3){
      // Force a fresh session response if an SDK cache returned an opaque session token.
      data=result(await (await auth()).getSession({fetchOptions:{headers:{'X-Force-Fetch':'true'}}}));
      if(!sameSession(generation,userId))throw new ServiceError('session_expired',401);
      token=data?.session?.token;
    }
    if(typeof token!=='string'||token.split('.').length!==3){
      // Better Auth JWT plugin exposes GET /token. Some session caches only contain
      // an opaque session token, and must never be passed to the game API.
      // Fetch with the browser-managed Auth cookie; no token is written to storage.
      const tokenUrl=CONFIG.authUrl.replace(/\/$/,'')+'/token';
      let tokenResponse;
      try{
        tokenResponse=await fetch(tokenUrl,{method:'GET',credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
      }catch{throw new ServiceError('session_token_unavailable',401);}
      if(!sameSession(generation,userId))throw new ServiceError('session_expired',401);
      if(!tokenResponse.ok)throw new ServiceError('session_token_unavailable',401);
      const payload=await tokenResponse.json().catch(()=>null);
      token=payload?.token;
    }
    if(typeof token!=='string'||token.split('.').length!==3)throw new ServiceError('session_token_unavailable',401);
    // Reject an obviously expired token or a token for a different signed-in user.
    try{
      const body=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if(body.sub!==userId||!Number.isFinite(body.exp)||body.exp*1000<=Date.now())
        throw new ServiceError('session_token_unavailable',401);
    }catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError('session_token_unavailable',401);}
    cachedToken={userId,token,expiresAt:tokenExpiry(token)};
    return token;
  })();
  tokenRequest=pending;
  try{return await pending.promise;}finally{if(tokenRequest===pending)tokenRequest=null;}
}
// Platform SSO bridge obtains the existing verified Neon JWT in memory only.
// Never persist it in query parameters, localStorage or application logs.
export async function getMemberAccessToken(){return accessToken();}

export async function initMember() {
  if(readyPromise)return readyPromise;
  const generation=sessionGeneration;
  readyPromise=(async()=>{
    try {
      const data=result(await (await auth()).getSession());
      if(generation!==sessionGeneration)return state;
      emit({ready:true,user:data?.user||null,error:null});
      if(data?.user)await refreshProfile();
    }catch(error){if(generation===sessionGeneration)emit({ready:true,error:error.code||'network_error'});}
    return state;
  })();
  return readyPromise;
}
export async function signIn(email,password) {
  const generation=invalidateSession();
  clearLocalMembership();
  result(await (await auth()).signIn.email({email,password}));
  const session=result(await (await auth()).getSession());
  if(generation!==sessionGeneration)throw new ServiceError('session_expired',401);
  emit({user:session?.user||null,profile:null,error:null});
  if(!state.user)throw new ServiceError('session_unavailable');
  return refreshProfile();
}
export async function signUp(email,password,name) {
  result(await (await auth()).signUp.email({email,password,name}));
  return {verificationRequired:true};
}
export async function sendVerification(email) {
  return result(await (await auth()).emailOtp.sendVerificationOtp({email,type:'email-verification'}));
}
export async function verifyEmail(email,otp) {
  const generation=invalidateSession();
  clearLocalMembership();
  result(await (await auth()).emailOtp.verifyEmail({email,otp}));
  const session=result(await (await auth()).getSession());
  if(generation!==sessionGeneration)throw new ServiceError('session_expired',401);
  emit({user:session?.user||null,profile:null,error:null});
  if(state.user)await refreshProfile();return Boolean(state.user);
}
export async function requestPasswordReset(email) {
  return result(await (await auth()).emailOtp.sendVerificationOtp({email,type:'forget-password'}));
}
export async function resetPassword(email,otp,password) {
  const response=result(await (await auth()).emailOtp.resetPassword({email,otp,password}));
  invalidateSession();clearLocalMembership();return response;
}
export async function signOut() {
  const generation=invalidateSession();
  result(await (await auth()).signOut());
  if(generation===sessionGeneration)clearLocalMembership();
}
export async function api(path,{method='GET',body,idempotency,signal,publicRequest=false}={}) {
  if(!CONFIG.apiUrl)throw new ServiceError('service_unavailable',503);
  const generation=sessionGeneration,userId=state.user?.id;
  const controller=new AbortController(),abort=()=>controller.abort(signal?.reason),timer=setTimeout(()=>controller.abort(),12000);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  try {
    for(let attempt=0;attempt<2;attempt++){
      const headers={'Accept':'application/json'};
      if(!publicRequest)headers.Authorization=`Bearer ${await accessToken(attempt===1)}`;
      if(body!==undefined)headers['Content-Type']='application/json';
      if(idempotency)headers['Idempotency-Key']=idempotency;
      const response=await fetch(CONFIG.apiUrl.replace(/\/$/,'')+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',credentials:'omit',signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!publicRequest&&!sameSession(generation,userId))throw new ServiceError('session_expired',401);
      if(response.status===401&&!publicRequest&&attempt===0){cachedToken=null;continue;}
      if(!response.ok){
        const retryHeader=response.headers.get('retry-after');
        const seconds=retryHeader===null?NaN:Number(retryHeader);
        const retryAfter=Number.isFinite(seconds)?seconds:retryHeader?Math.ceil((Date.parse(retryHeader)-Date.now())/1000):NaN;
        const details={...(data.error?.details&&typeof data.error.details==='object'?data.error.details:{}),...(Number.isFinite(retryAfter)?{retryAfter:Math.max(1,retryAfter)}:{})};
        throw new ServiceError(data.error?.code||'service_error',response.status,details);
      }
      return data;
    }
  }catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError(error.name==='AbortError'?'request_timeout':'network_error');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function refreshProfile({apply=true}={}) {
  const generation=sessionGeneration,userId=state.user?.id;
  if(!userId)return null;
  try{
    const profile=await api('/v1/profile');
    if(!sameSession(generation,userId))return null;
    emit({profile,error:null});setImageScope(profile.profile.id);setEntitlements({customImages:profile.entitlement?.customImages===true});
    if(apply){
      setAppearance(profile.appearance);
      if(profile.entitlement?.customImages&&profile.appearance?.customBackgroundEnabled){
        await restoreCustomImage().catch(()=>{});
        if(!sameSession(generation,userId))return null;
      }
    }
    return profile;
  }catch(error){if(!sameSession(generation,userId))return null;emit({error:error.code||'network_error'});throw error;}
}
export async function patchProfile(patch) {
  const generation=sessionGeneration,userId=state.user?.id;
  const profile=await api('/v1/profile',{method:'PATCH',body:patch});
  if(!sameSession(generation,userId))return null;
  emit({profile,error:null});setImageScope(profile.profile.id);setEntitlements({customImages:profile.entitlement?.customImages===true});setAppearance(profile.appearance);return profile;
}
// Include identity and payload: an uncertain purchase can be retried after a
// temporary connection loss without colliding with another account or item.
const pendingKeys=new Map();
export async function economyAction(path,body,scope=path) {
  const userId=state.user?.id;if(!userId)throw new ServiceError('sign_in_required',401);
  const operation=`${userId}:${scope}:${JSON.stringify(body)}`;
  let idempotency=pendingKeys.get(operation);
  if(!idempotency){if(pendingKeys.size>=128)throw new ServiceError('request_timeout');idempotency=crypto.randomUUID();pendingKeys.set(operation,idempotency);}
  try {
    const response=await api(path,{method:'POST',body,idempotency});
    pendingKeys.delete(operation);
    // The mutation has committed. A failed display refresh must not turn this
    // success into a failed purchase that the player repeats with a new key.
    await refreshProfile({apply:false}).catch(()=>{});
    return response;
  }catch(error){
    if(error.status>=400&&error.status<500&&![401,408,429].includes(error.status))pendingKeys.delete(operation);
    throw error;
  }
}
export const consumeInventory = itemId => economyAction('/v1/inventory/use',{itemId,mode:'party'},`use:${itemId}`);
