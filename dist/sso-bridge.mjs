import {loadPortalSsoIntent,clearPortalSsoIntent} from './sso-flow.mjs?v=39';
import {memberState,initMember,getMemberAccessToken} from './games/spinrealm/member-client.mjs';

let storage;
try{storage=window.sessionStorage;}catch{/* The URL still works when storage is blocked. */}
const intent=loadPortalSsoIntent(location.href,{
  storage,replaceUrl:url=>history.replaceState(history.state,'',url)
});
if(intent){
  const section=document.createElement('section');
  section.className='container';
  section.setAttribute('aria-label','SnowRealm Games 身分連結');
  section.style.cssText='margin:1rem auto;padding:1.5rem;border:1px solid #438a98;border-radius:1rem;background:#10263a;';
  const heading=document.createElement('h2');
  heading.textContent='連結《轉磚》進度';
  const detail=document.createElement('p');
  detail.textContent='登入 SnowRealm Games 後，請明確確認是否將你的平台帳號授權給《轉磚》。現有存檔不會自動合併或覆蓋。';
  const button=document.createElement('button');
  button.className='button primary';button.type='button';
  button.textContent='繼續前往授權';
  const status=document.createElement('p');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  section.append(heading,detail,button,status);
  const hero=document.querySelector('.hero');
  (hero?.parentNode||document.querySelector('main')||document.body).insertBefore(section,hero||null);
  button.addEventListener('click',async()=>{
    if(button.disabled)return;
    button.disabled=true;
    try{
      await initMember();
      if(!memberState().user){
        status.textContent='請先從頁面右上角登入 SnowRealm Games，成功後再確認授權。';
        document.querySelector('[data-member-open="account"]')?.click();
        return;
      }
      if(Date.now()>=intent.expiresAt){
        clearPortalSsoIntent(storage,intent.state);
        status.textContent='授權請求已過期，請回到《轉磚》重新發起連結。';
        return;
      }
      const jwt=await getMemberAccessToken();
      status.textContent='正在核對平台登入身分…';
      const next=new URL('https://identity.snowrealm.pet/oauth/authorize');
      next.search=new URLSearchParams({
        client_id:intent.clientId,redirect_uri:intent.redirectUri,state:intent.state,
        nonce:intent.nonce,code_challenge:intent.codeChallenge,
        code_challenge_method:'S256',response_type:'code'
      });
      const response=await fetch(next.origin+next.pathname,{
        method:'POST',mode:'cors',credentials:'include',cache:'no-store',
        headers:{Authorization:'Bearer '+jwt}
      });
      if(response.status!==204)throw Error('identity_unavailable');
      clearPortalSsoIntent(storage,intent.state);
      location.assign(next.href);
    }catch{
      status.textContent='SnowRealm Identity 尚未可用或授權未完成。沒有任何存檔被綁定，請稍後再試。';
    }finally{button.disabled=false;}
  });
}
