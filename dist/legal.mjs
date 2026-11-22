// Locale-first privacy and regional information. This is not ID or guardian verification.
import { REGION_POLICIES, REGIONS, AGE_GROUPS, legalWarning } from './region-policies.mjs';
import { setLocale } from './games/spinrealm/i18n.mjs';
import { localizedRegionSummary } from './region-policy-locales.mjs';
const STORAGE='srg.consent.v2',VERSION='2026-11-20.2';
const LANGS=['zh-TW','zh-CN','en','ja','ko'],LANG_NAMES=['繁體中文','简体中文','English','日本語','한국어'];
const REGION_NAMES={
tw:['臺灣','台湾','Taiwan','台湾','대만'],
hk:['香港','香港','Hong Kong','香港','홍콩'],mo:['澳門','澳门','Macau','マカオ','마카오'],
cn:['中國大陸','中国大陆','Mainland China','中国本土','중국 본토'],
jp:['日本','日本','Japan','日本','일본'],kr:['韓國','韩国','South Korea','韓国','대한민국'],
my:['馬來西亞','马来西亚','Malaysia','マレーシア','말레이시아'],sg:['新加坡','新加坡','Singapore','シンガポール','싱가포르'],
au:['澳洲','澳大利亚','Australia','オーストラリア','호주'],us:['美國','美国','United States','アメリカ','미국'],
uk:['英國','英国','United Kingdom','イギリス','영국'],other:['其他地區','其他地区','Other regions','その他','기타 지역']
};
const TEXT={
'zh-TW':['語言與所在地區','步驟 1／2：語言','步驟 2／2：地區、年齡與政策','介面語言','依裝置語言預設；不使用 IP 猜測位置。','下一步：選擇所在地區','返回修改語言','居住國家／地區','年齡區間','請選擇','未滿 13 歲','13 歲','14–15 歲','16–17 歲','18 歲以上','適用政策與目前缺口','尚未完成','官方資料','隱私政策','Cookie 政策','使用條款','未成年人保護','必要儲存','登入、安全、遊戲偏好及離線檔案，無法以拒絕選用分析停止。','選用分析（預設關閉）','這裡只記錄你的選擇，尚未全面控制第三方技術日誌。','我已閱讀文件，理解當地規範及目前尚未完成的合規事項。','拒絕選用分析','儲存選擇','同意選用分析','請先選擇地區、年齡並確認已閱讀文件。','語言、地區與 Cookie 設定','自填地區與年齡不等於實名或監護人認證。','本服務尚未完成所有地區的法律合規審查。'],
'zh-CN':['语言与所在地区','步骤 1／2：语言','步骤 2／2：地区、年龄与政策','界面语言','按照设备语言默认；不使用 IP 猜测位置。','下一步：选择所在地区','返回修改语言','居住国家／地区','年龄区间','请选择','未满 13 岁','13 岁','14–15 岁','16–17 岁','18 岁以上','适用政策与当前缺口','尚未完成','官方资料','隐私政策','Cookie 政策','使用条款','未成年人保护','必要存储','登录、安全、游戏偏好和离线文件，拒绝可选分析不关闭必要功能。','可选分析（默认关闭）','这里只记录你的选择，尚未完全控制第三方技术日志。','我已阅读文件，理解当地规则及尚未完成的合规事项。','拒绝可选分析','保存选择','同意可选分析','请先选择地区、年龄并确认阅读文件。','语言、地区和 Cookie 设置','自填地区与年龄不等于实名或监护人认证。','本服务尚未完成所有地区的法律合规审查。'],
en:['Language & region','Step 1 of 2: Language','Step 2 of 2: Region, age & policies','Display language','Defaults to device language; we do not infer location from IP.','Next: choose region','Back to language','Country or region of residence','Age group','Please select','Under 13','Age 13','Ages 14–15','Ages 16–17','18 or older','Applicable policies and outstanding gaps','Not yet implemented','Official source','Privacy policy','Cookie policy','Terms of use','Protection of minors','Essential storage','Login, security, gameplay preferences and offline files. Not disabled by rejecting analytics.','Optional analytics (off by default)','Only your preference is recorded; third-party technical logging is not fully controlled yet.','I have read the policies and understand regional requirements and outstanding compliance gaps.','Reject optional analytics','Save preferences','Accept optional analytics','Choose a region and age group and acknowledge the policies.','Language, region & cookie settings','Self-declared region and age do not verify identity or parental consent.','This service has not completed compliance review for every region.'],
ja:['言語と地域','ステップ 1／2：言語','ステップ 2／2：地域、年齢、規約','表示言語','端末言語を初期値にします。IP から所在地は判定しません。','次へ：地域の選択','言語に戻る','居住国・地域','年齢区分','選択してください','13歳未満','13歳','14～15歳','16～17歳','18歳以上','適用規則と未対応事項','未対応','公的資料','プライバシー','Cookie','利用規約','未成年者保護','必須保存','ログイン、安全、ゲーム設定、オフライン資産。','任意の解析（初期設定オフ）','現状は選択だけ保存し、外部ログを完全には停止しません。','規約と地域の要件、未対応事項を確認しました。','解析を拒否','設定を保存','解析を許可','地域、年齢と規約の確認が必要です。','言語・地域・Cookie 設定','自己申告は本人や保護者の確認に代わりません。','すべての地域で法令適合が確認されたわけではありません。'],
ko:['언어 및 지역','1 / 2: 언어','2 / 2: 지역, 나이 및 정책','표시 언어','기기 언어를 기본값으로 사용하며 IP로 지역을 판단하지 않습니다.','다음: 지역 선택','언어로 돌아가기','거주 국가/지역','연령대','선택하세요','13세 미만','13세','14~15세','16~17세','18세 이상','적용 규정과 미완료 사항','미구현','공식 자료','개인정보처리방침','쿠키 정책','이용약관','미성년자 보호','필수 저장','로그인, 보안, 게임 설정 및 오프라인 파일.','선택 분석 (기본 꺼짐)','현재는 선택만 저장하며 외부 기술 로그를 완전히 차단하지 않습니다.','정책과 지역별 규정 및 미완료 사항을 확인했습니다.','선택 분석 거부','설정 저장','선택 분석 동의','지역, 연령대 및 정책 확인이 필요합니다.','언어, 지역 및 쿠키 설정','자기 신고는 신원 및 보호자 인증이 아닙니다.','모든 지역의 법규 준수가 검증된 것은 아닙니다.']
};
const FIELDS=['title','first','second','language','device','next','back','region','age','select','under13','age13','age14','age16','adult','policy','gap','source','privacy','cookie','terms','minor','essential','essentialDesc','analytics','analyticsDesc','ack','reject','save','agree','error','settings','warning','unverified'];
const dictionary=Object.fromEntries(Object.entries(TEXT).map(([code,values])=>[code,Object.fromEntries(FIELDS.map((key,i)=>[key,values[i]]))]));
function deviceLanguage(){
 for(const value of [...(navigator.languages||[]),navigator.language||'']){
  const v=String(value).toLowerCase();
  if(v.startsWith('zh'))return /hans|cn|sg/.test(v)?'zh-CN':'zh-TW';
  if(v.startsWith('ja'))return'ja';
  if(v.startsWith('ko'))return'ko';
  if(v.startsWith('en'))return'en';
 }
 return'en';
}
function load(){try{const value=JSON.parse(localStorage.getItem(STORAGE)||'null');if(value?.version===VERSION&&REGIONS.includes(value.region)&&AGE_GROUPS.includes(value.age)&&LANGS.includes(value.language)&&typeof value.optionalAnalytics==='boolean')return value;}catch{}return null;}
let state=load(),language=state?.language||deviceLanguage(),step=1;
export function consentPreferences(){return state?{...state}:null;}
const t=key=>dictionary[language]?.[key]||dictionary.en[key]||key;
const root=document.createElement('div');root.id='srgConsentPanel';root.className='srg-consent';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','srgConsentTitle');
root.innerHTML='<section class="srg-consent-panel"><span id="srgStep" class="srg-consent-tag"></span><h2 id="srgConsentTitle"></h2><div id="srgLanguageStage"><label id="srgLanguageLabel" for="srgLanguage"></label><select id="srgLanguage"></select><p id="srgDeviceHelp"></p><button id="srgNextLanguage" type="button"></button></div><div id="srgRegionStage" hidden><button id="srgPrevious" type="button"></button><label id="srgRegionLabel" for="srgRegion"></label><select id="srgRegion"></select><label id="srgAgeLabel" for="srgAge"></label><select id="srgAge"></select><section id="srgJurisdiction" class="srg-jurisdiction" aria-live="polite"></section><p id="srgAgeNotice" class="srg-consent-note"></p><div class="srg-policy-links"><a target="_blank" rel="noopener" href="/privacy.html" data-legal="privacy"></a> · <a target="_blank" rel="noopener" href="/cookies.html" data-legal="cookie"></a> · <a target="_blank" rel="noopener" href="/terms.html" data-legal="terms"></a> · <a target="_blank" rel="noopener" href="/minor-protection.html" data-legal="minor"></a></div><label class="srg-consent-row"><input type="checkbox" checked disabled><span><strong id="srgEssential"></strong><span id="srgEssentialDesc"></span></span></label><label class="srg-consent-row"><input type="checkbox" id="srgAnalytics"><span><strong id="srgAnalyticsTitle"></strong><span id="srgAnalyticsDesc"></span></span></label><label class="srg-check"><input type="checkbox" id="srgAcceptTerms"><span id="srgAcceptTermsText"></span></label><p id="srgConsentMessage" class="srg-consent-status" role="status" aria-live="polite"></p><div class="srg-consent-actions"><button data-consent-action="essential" type="button"></button><button data-consent-action="save" type="button"></button><button data-consent-action="accept" type="button"></button></div></div></section>';
document.body.append(root);
const el=id=>root.querySelector('#'+id),region=el('srgRegion'),age=el('srgAge'),choice=el('srgLanguage');
for(const [i,code] of LANGS.entries())choice.add(new Option(LANG_NAMES[i],code));
const nav=document.createElement('nav');nav.className='srg-legal-links';nav.setAttribute('aria-label','Legal and privacy');
nav.innerHTML='<a href="/privacy.html" data-legal-nav="privacy"></a><a href="/cookies.html" data-legal-nav="cookie"></a><a href="/terms.html" data-legal-nav="terms"></a><a href="/minor-protection.html" data-legal-nav="minor"></a><button type="button" id="srgConsentSettings"></button>';
document.body.append(nav);
function regionName(id){return REGION_NAMES[id]?.[LANGS.indexOf(language)]||REGION_POLICIES[id]?.name||id;}
function updateRegion(){
 const box=el('srgJurisdiction');box.replaceChildren();
 const rule=REGION_POLICIES[region.value];
 if(rule){
  const heading=document.createElement('h3');heading.textContent=language==='zh-TW'||language==='zh-CN'?rule.headline:regionName(region.value)+' · '+t('policy');box.append(heading);
  const note=document.createElement('p');note.textContent=localizedRegionSummary(region.value,language)||rule.summary;box.append(note);
  const gap=document.createElement('p');gap.className='srg-compliance-gap';gap.textContent=t('gap')+'：'+(['zh-TW','zh-CN'].includes(language)?rule.gap:t('unverified'));box.append(gap);
  const sources=document.createElement('div');sources.className='srg-policy-sources';
  for(const [name,url] of rule.sources){const link=document.createElement('a');link.href=url;link.rel='noopener noreferrer';link.target='_blank';link.textContent=t('source')+'：'+name;sources.append(link);}
  box.append(sources);
 }
 el('srgAgeNotice').textContent=legalWarning(region.value,age.value)||t('warning');
}
function update(){
 el('srgStep').textContent=t(step===1?'first':'second');el('srgConsentTitle').textContent=t('title');
 for(const [id,key]of [['srgLanguageLabel','language'],['srgDeviceHelp','device'],['srgNextLanguage','next'],['srgPrevious','back'],['srgRegionLabel','region'],['srgAgeLabel','age'],['srgEssential','essential'],['srgEssentialDesc','essentialDesc'],['srgAnalyticsTitle','analytics'],['srgAnalyticsDesc','analyticsDesc'],['srgAcceptTermsText','ack']])el(id).textContent=t(key);
 for(const type of ['privacy','cookie','terms','minor']){
  root.querySelector('[data-legal="'+type+'"]').textContent=t(type);
  nav.querySelector('[data-legal-nav="'+type+'"]').textContent=t(type);
 }
 nav.querySelector('button').textContent=t('settings');
 for(const [a,k]of [['essential','reject'],['save','save'],['accept','agree']])root.querySelector('[data-consent-action="'+a+'"]').textContent=t(k);
 const chosen=region.value;region.replaceChildren(new Option(t('select'),''));
 for(const id of REGIONS)region.add(new Option(regionName(id),id));region.value=chosen;
 const chosenAge=age.value;age.replaceChildren(new Option(t('select'),''));
 for(const [i,id] of AGE_GROUPS.entries())age.add(new Option(t(['under13','age13','age14','age16','adult'][i]),id));age.value=chosenAge;
 updateRegion();
}
function showStep(n){step=n;el('srgLanguageStage').hidden=n!==1;el('srgRegionStage').hidden=n!==2;el('srgStep').textContent=t(n===1?'first':'second');(n===1?choice:region).focus();}
function open(force=false){
 if(!force&&state)return;
 language=state?.language||deviceLanguage();choice.value=language;
 el('srgAnalytics').checked=state?.optionalAnalytics||false;el('srgAcceptTerms').checked=Boolean(state);
 el('srgConsentMessage').textContent='';root.hidden=false;update();
 region.value=state?.region||'';age.value=state?.age||'';updateRegion();showStep(1);
}
function finish(optionalAnalytics){
 if(!REGIONS.includes(region.value)||!AGE_GROUPS.includes(age.value)||!el('srgAcceptTerms').checked){
  el('srgConsentMessage').textContent=t('error');return;
 }
 const next={version:VERSION,language,region:region.value,age:age.value,optionalAnalytics,noticesAccepted:true,recordedAt:new Date().toISOString()};
 try{localStorage.setItem(STORAGE,JSON.stringify(next));}catch{el('srgConsentMessage').textContent=t('error');return;}
 state=next;setLocale(language);document.documentElement.lang=language==='zh-TW'?'zh-Hant':language==='zh-CN'?'zh-Hans':language;
 root.hidden=true;window.dispatchEvent(new CustomEvent('srg:consent-changed',{detail:{language,region:state.region,age:state.age,optionalAnalytics:state.optionalAnalytics}}));
}
choice.addEventListener('change',()=>{language=choice.value;update();});
el('srgNextLanguage').addEventListener('click',()=>{setLocale(language);showStep(2);});
el('srgPrevious').addEventListener('click',()=>showStep(1));
region.addEventListener('change',updateRegion);age.addEventListener('change',updateRegion);
root.querySelectorAll('[data-consent-action]').forEach(button=>button.addEventListener('click',()=>{
 const action=button.dataset.consentAction;
 finish(action==='essential'?false:action==='accept'?true:el('srgAnalytics').checked);
}));
nav.querySelector('button').addEventListener('click',()=>open(true));
window.addEventListener('storage',event=>{if(event.key!==STORAGE)return;state=load();if(state){language=state.language;setLocale(language);update();}else if(document.body.dataset.srgPage!=='legal')open();});
update();
if(state){language=state.language;setLocale(language);update();}
else if(document.body.dataset.srgPage!=='legal')open();
