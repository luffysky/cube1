// SnowRealm Games consent centre. Self-declaration is not real-name verification.
// No birth date, government ID, or child's personal details are collected here.
const STORAGE='srg.consent.v1', POLICY='2026-11-20.1';
let state=null;
try { const s=JSON.parse(localStorage.getItem(STORAGE)||'null');
  if(s?.version===POLICY&&['other','mainland'].includes(s.region)&&['adult','14-17','under14'].includes(s.age)&&typeof s.optionalAnalytics==='boolean') state=s;
} catch {}
export function consentPreferences(){return state?{...state}:null;}
const root=document.createElement('div');
root.id='srgConsentPanel';root.className='srg-consent';root.hidden=true;
root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','srgConsentTitle');
root.innerHTML=`
<section class="srg-consent-panel">
 <span class="srg-consent-tag">SNOWREALM GAMES · PRIVACY</span>
 <h2 id="srgConsentTitle">開始之前，先保護你的選擇</h2>
 <p>請閱讀 <a target="_blank" rel="noopener" href="/privacy.html">隱私政策</a>、
 <a target="_blank" rel="noopener" href="/cookies.html">Cookie 政策</a>、
 <a target="_blank" rel="noopener" href="/terms.html">使用條款</a>與
 <a target="_blank" rel="noopener" href="/minor-protection.html">未成年人保護說明</a>。
 必要登入、安全與離線儲存不依賴選用 Cookie 的同意。</p>
 <label for="srgRegion">所在地區</label>
 <select id="srgRegion"><option value="">請選擇</option><option value="other">臺灣及其他地區</option><option value="mainland">中國大陸</option></select>
 <label for="srgAge">年齡區間（不收集生日）</label>
 <select id="srgAge"><option value="">請選擇</option><option value="adult">18 歲以上</option><option value="14-17">14 至 17 歲</option><option value="under14">未滿 14 歲</option></select>
 <p class="srg-consent-note" id="srgAgeNotice">年齡自我聲明不能替代實名核驗。中國大陸正式網路遊戲服務須另外完成相關合規措施，目前尚未提供相應的實名／防沉迷系統。</p>
 <label class="srg-consent-row"><input type="checkbox" checked disabled><span><strong>必要儲存</strong>登入 Session、操作偏好、必要安全紀錄及 PWA 離線資料。此類必要項目始終啟用。</span></label>
 <label class="srg-consent-row"><input id="srgAnalytics" type="checkbox"><span><strong>選用分析（預設關閉）</strong>這裡只保存你對未來選用分析的意願，目前不會因勾選而額外載入分析腳本。第三方服務必要紀錄請見政策。</span></label>
 <label class="srg-check"><input id="srgAcceptTerms" type="checkbox"><span>我已閱讀條款及隱私、未成年人保護說明，理解服務限制。</span></label>
 <div id="srgConsentMessage" class="srg-consent-status" role="status" aria-live="polite"></div>
 <div class="srg-consent-actions">
   <button type="button" data-consent-action="essential">拒絕選用分析並繼續</button>
   <button type="button" data-consent-action="save">儲存目前選擇</button>
   <button type="button" data-consent-action="accept">同意選用分析並繼續</button>
 </div>
</section>`;
document.body.append(root);
const region=root.querySelector('#srgRegion'),age=root.querySelector('#srgAge'),analytics=root.querySelector('#srgAnalytics'),terms=root.querySelector('#srgAcceptTerms'),message=root.querySelector('#srgConsentMessage');
const gate=()=>{const mainland=region.value==='mainland',minor=age.value!=='adult'&&age.value!=='';
  root.querySelector('#srgAgeNotice').textContent=mainland?
  '中國大陸網路遊戲正式營運涉及實名驗證、防沉迷及適齡提示。目前本服務未提供相關法定驗證及防沉迷系統，請勿將本頁自填年齡視為合規核驗；未成年人應在監護人指導下使用。':
  minor?'未滿 18 歲玩家請由監護人陪同閱讀隱私與使用條款；部分線上功能可能需要額外核驗。':'年齡與所在地區僅供說明和偏好用途，不屬於實名認證。';
};
function open(force=false){if(!force&&state)return;region.value=state?.region||'';age.value=state?.age||'';analytics.checked=state?.optionalAnalytics||false;terms.checked=Boolean(state);message.textContent='';root.hidden=false;gate();root.querySelector('select').focus();}
function finish(optional){
  if(!region.value||!age.value||!terms.checked){message.textContent='請先選擇地區、年齡區間並確認已閱讀文件。';return;}
  state={version:POLICY,region:region.value,age:age.value,optionalAnalytics:optional,noticesAccepted:true,recordedAt:new Date().toISOString()};
  try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{message.textContent='瀏覽器無法儲存選擇，請檢查儲存權限。';return;}
  root.hidden=true;
  window.dispatchEvent(new CustomEvent('srg:consent-changed',{detail:{region:state.region,age:state.age,optionalAnalytics:state.optionalAnalytics}}));
}
region.addEventListener('change',gate);age.addEventListener('change',gate);
root.querySelectorAll('[data-consent-action]').forEach(btn=>btn.addEventListener('click',()=>{
  const action=btn.dataset.consentAction;
  finish(action==='essential'?false:action==='accept'?true:analytics.checked);
}));
const nav=document.createElement('nav');nav.className='srg-legal-links';nav.setAttribute('aria-label','法律與隱私');
nav.innerHTML='<a href="/privacy.html">隱私政策</a><a href="/cookies.html">Cookie 政策</a><a href="/terms.html">使用條款</a><a href="/minor-protection.html">未成年人保護</a><button type="button" id="srgConsentSettings">Cookie 與同意設定</button>';
document.body.append(nav);nav.querySelector('button').addEventListener('click',()=>open(true));
window.addEventListener('storage',e=>{if(e.key===STORAGE){try{const s=JSON.parse(e.newValue);if(s?.version===POLICY)state=s;else{state=null;open();}}catch{state=null;open();}}});
// Policy pages must remain readable without first accepting anything.
if(!state && document.body.dataset.srgPage!=='legal')open();
