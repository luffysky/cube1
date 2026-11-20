import {parsePortalSsoIntent} from './sso-flow.mjs';
import {memberState,initMember,getMemberAccessToken} from './games/spinrealm/member-client.mjs';

const intent=parsePortalSsoIntent(location.href);
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
  button.textContent='確認授權並返回《轉磚》';
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
      const jwt=await getMemberAccessToken();
      status.textContent='正在核對平台身分與一次性授權碼…';
      const response=await fetch('https://identity.snowrealm.pet/oauth/authorize',{
        method:'POST',mode:'cors',cache:'no-store',
        headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
        body:JSON.stringify({...intent,consent:true})
      });
      const grant=await response.json().catch(()=>null);
      if(!response.ok||!grant||typeof grant.code!=='string'||
        !/^[A-Za-z0-9_-]{43}$/.test(grant.code)||
        grant.redirectUri!==intent.redirectUri||grant.state!==intent.state)
        throw Error('identity_unavailable');
      const next=new URL(intent.redirectUri);
      next.searchParams.set('code',grant.code);
      next.searchParams.set('state',intent.state);
      location.assign(next.href);
    }catch{
      status.textContent='SnowRealm Identity 尚未可用或授權未完成。沒有任何存檔被綁定，請稍後再試。';
    }finally{button.disabled=false;}
  });
}
