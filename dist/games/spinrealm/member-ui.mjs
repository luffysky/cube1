import { t, getLocale, setLocale, subscribeLocale, hasTranslation } from './i18n.mjs';
import { memberState, subscribeMember, initMember, signIn, signUp, signOut, sendVerification, verifyEmail, requestPasswordReset, resetPassword, api, patchProfile, refreshProfile, economyAction } from './member-client.mjs';
import { THEMES, getAppearance, setAppearance, applyAppearance, drawBlock, drawBoardBackground, setCustomImage, clearCustomImage, clearCustomPreview, getCustomImageState } from './appearance.mjs';
import { CATALOG, MEMBERSHIP, FREE_COSMETICS } from './catalog.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LOCALES=[['zh-TW','繁體中文'],['zh-CN','简体中文'],['en','English'],['ja','日本語'],['ko','한국어']];
const label=(key)=>esc(t(key));
const button=(key,action,extra='')=>`<button type="button" class="srg-button" data-member-action="${action}" ${extra}>${label(key)}</button>`;
const field=(key,name,type='text',extra='')=>`<label class="srg-field"><span>${label(key)}</span><input name="${name}" type="${type}" required ${extra}></label>`;

export function initMemberUI({mount=document.querySelector('.topbar')||document.querySelector('.site-header'),beforeOpen=()=>{},afterClose=()=>{},onRanked=null}={}){
  let page='account',authMode='login',email='',busy=false,previewBase=null,friends=null,leaderboard=null,history=null,walletHistory=null,quests=null,rewardStatus=null;
  const toolbar=document.createElement('div');toolbar.className='srg-toolbar';
  toolbar.innerHTML=`<button class="srg-coin" type="button" data-member-open="wallet"><span aria-hidden="true">◈</span><b data-wallet-number>—</b><span class="srg-coin-name" data-i18n="wallet.coins">${label('wallet.coins')}</span></button><button type="button" class="srg-icon-button" data-member-open="shop" aria-label="${label('shop.title')}" title="${label('shop.title')}">◐ <span data-i18n="shop.title">${label('shop.title')}</span></button><button type="button" class="srg-icon-button" data-member-open="friends" aria-label="${label('friends.title')}">♧ <span data-i18n="friends.title">${label('friends.title')}</span></button><label class="srg-language"><span class="srg-sr" data-i18n="settings.language">${label('settings.language')}</span><select data-locale aria-label="${label('settings.language')}">${LOCALES.map(([value,name])=>`<option value="${value}">${name}</option>`).join('')}</select></label><button type="button" class="srg-account-button" data-member-open="account"><span aria-hidden="true">◎</span><span data-member-name translate="no">${label('account.login')}</span></button>`;
  mount?.insertAdjacentElement('afterend',toolbar);
  const dialog=document.createElement('dialog');dialog.id='memberDialog';dialog.className='member-dialog';dialog.setAttribute('aria-labelledby','memberTitle');
  dialog.innerHTML=`<div class="srg-dialog-head"><div><p>SNOWREALM GAMES</p><h2 id="memberTitle"></h2></div><button type="button" class="srg-close" data-member-action="close" aria-label="${label('common.close')}">×</button></div><div class="srg-member-layout"><nav class="srg-member-nav" aria-label="${label('account.title')}"></nav><section class="srg-member-content"><div id="memberContent"></div></section></div><div class="srg-status" id="memberStatus" role="status" aria-live="polite"></div>`;
  document.body.append(dialog);
  const content=dialog.querySelector('#memberContent'),status=dialog.querySelector('#memberStatus');
  const navs=[['account','account.title','◎'],['wallet','wallet.title','◈'],['shop','shop.title','◐'],['friends','friends.title','♧'],['ranked','ranked.title','♜'],['plus','subscription.title','✦']];
  const message=(key,error=false)=>{status.textContent=t(key);status.classList.toggle('is-error',error);};
  const errorMessage=error=>{
    const code=String(error?.code||'network_error');const key=hasTranslation(code)?code:`errors.${code}`;const translated=t(key);const unsupported=code.toLowerCase()==='feature_not_supported';status.textContent=unsupported?'登入服務回報此註冊操作目前不受支援（feature_not_supported）。請聯絡管理員檢查 Neon Auth 設定與註冊請求；這不代表你的網路斷線。':translated===key?t('errors.network_error')+` (${code})`:translated;status.classList.add('is-error');
  };
  const signedIn=()=>Boolean(memberState().user);
  const profile=()=>memberState().profile;
  const owned=id=>FREE_COSMETICS.includes(id)||profile()?.ownedCosmetics?.includes(id);
  const requireAccount=()=>`<div class="srg-notice"><p>${label('account.signInToContinue')}</p>${button('account.login','login')}</div>`;
  function renderToolbar(){
    const s=memberState();toolbar.querySelector('[data-wallet-number]').textContent=s.profile?.wallet?.balance?.toLocaleString()??'—';
    toolbar.querySelector('[data-member-name]').textContent=s.profile?.profile?.nickname||(s.user?t('account.title'):t('account.login'));
    toolbar.querySelector('[data-locale]').value=getLocale();
  }
  function renderAccount(){
    if(signedIn()){
      const p=profile();
      return `<div class="srg-profile-hero"><span class="srg-profile-avatar">${esc((p?.profile?.nickname||memberState().user.name||'P').slice(0,1).toUpperCase())}</span><div><span class="srg-kicker">SNOWREALM ID</span><h3 translate="no">${esc(p?.profile?.nickname||memberState().user.name||t('account.title'))}</h3><p>${esc(memberState().user.email)}</p></div></div>${!p?`<div class="srg-notice">${label('account.profileUnavailable')}${button('common.retry','refresh')}</div>`:''}<form data-form="profile">${field('account.nickname','nickname','text',`minlength="2" maxlength="24" autocomplete="nickname" value="${esc(p?.profile?.nickname||'')}"`)}<button class="srg-button srg-primary" type="submit">${label('common.save')}</button></form><div class="srg-detail-list"><div><span>${label('friends.myCode')}</span><code>${esc(p?.profile?.friendCode||'—')}</code>${button('common.copy','copy-code')}</div><div><span>${label('subscription.title')}</span><strong>${label(p?.entitlement?.plus?'subscription.active':'subscription.free')}</strong></div><div><span>${label('ranked.rating')}</span><strong>${p?.rank?.rating??1000} · ${label(`rank.${p?.rank?.tier||'silver'}`)}</strong></div></div><p class="srg-muted">${label('account.storageNote')}</p>${button('account.logout','logout')}`;
    }
    const signup=authMode==='register',verify=authMode==='verify',reset=authMode==='reset';
    return `<p class="srg-kicker">ONE ACCOUNT. MORE WORLDS.</p><h3 class="srg-section-title">${label(verify?'account.verify':reset?'account.reset':signup?'account.register':'account.welcome')}</h3><p class="srg-muted">${label('account.benefits')}</p><form data-form="auth">${field('account.email','email','email',`autocomplete="email" value="${esc(email)}"`)}${signup?field('account.nickname','nickname','text','minlength="2" maxlength="24" autocomplete="nickname"'):''}${verify||reset?field('account.otp','otp','text','inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"'):''}${!verify?field('account.password','password','password',`minlength="10" maxlength="128" autocomplete="${signup||reset?'new-password':'current-password'}"`):''}<button class="srg-button srg-primary" type="submit">${label(verify?'account.verify':reset?'account.reset':signup?'account.register':'account.login')}</button></form><div class="srg-auth-links">${verify?button('account.resend','resend'):reset?button('account.sendReset','send-reset'):button(signup?'account.haveAccount':'account.createAccount',signup?'login':'register')}${!verify&&!reset?button('account.forgot','forgot'):button('account.backToLogin','login')}</div><p class="srg-muted srg-small">${label('account.privacyNote')}</p>`;
  }
  function renderCoinReward() {
    const plus = profile()?.entitlement?.plus === true;
    const reward = rewardStatus?.userId === memberState().user?.id ? rewardStatus : null;
    const available = plus && reward?.canClaimPlus && reward.remaining > 0;
    return `<section class="srg-reward-ad">
      <h3>${label(plus?'ads.plusTitle':'ads.rewardTitle')}</h3>
      <p>${label(plus?'ads.plusDesc':'ads.rewardDesc')}</p>
      ${button(plus?'ads.plusClaim':'ads.rewardButton',plus?'plus-reward':'watch-ad',available?'':'disabled')}
      <p class="srg-muted" role="status">${plus && reward && reward.canClaimPlus ? label('ads.claimedToday')+' '+reward.claimedToday+' / '+reward.limit : label(plus?'ads.plusUnavailable':'ads.rewardPending')} ${label('ads.rewardLimit')}</p>
    </section>`;
  }
  function renderWallet(){
    const p=profile();
    return `<div class="srg-wallet-hero"><span>◈</span><strong>${p?.wallet?.balance?.toLocaleString()??'—'}</strong><p>${label('wallet.balance')}</p></div>${signedIn()?button(p?.daily?.claimed?'wallet.claimed':'wallet.daily','daily',p?.daily?.claimed?'disabled':''):requireAccount()}${renderCoinReward()}<section class="srg-quest-card"><h3>${label('quests.title')}</h3><p>${label('quests.desc')}</p>${!signedIn()?requireAccount():!quests?'<p class="srg-muted">'+label('quests.unavailable')+'</p>':quests.quests.map(q=>`<div class="srg-quest-row"><div><strong>${label('quests.'+q.id)}</strong><small>${q.progress} / ${q.target} · +${q.coins} ◈</small></div><button class="srg-button" type="button" data-quest-claim="${esc(q.id)}" ${(!q.completed||q.claimed)?'disabled':''}>${label(q.claimed?'quests.claimed':q.completed?'quests.claim':'quests.incomplete')}</button></div>`).join('')}</section><div class="srg-info-grid"><article><h3>${label('wallet.earn')}</h3><p>${label('wallet.rules')}</p></article><article><h3>${label('wallet.spend')}</h3><p>${label('wallet.spendRules')}</p></article></div><p class="srg-notice">${label('wallet.localScoreNote')}</p><h3>${label('wallet.history')}</h3>${walletHistory?.entries?.length?`<div class="srg-history">${walletHistory.entries.slice(0,15).map(row=>`<div><span>${label('ledger.'+row.reason)}<small>${esc(new Date(row.createdAt).toLocaleString(getLocale()))}</small></span><strong class="${row.delta>0?'srg-positive':''}">${row.delta>0?'+':''}${row.delta}</strong></div>`).join('')}</div>`:`<p class="srg-muted">${label('common.empty')}</p>`}<details class="srg-details"><summary>${label('score.rulesTitle')}</summary><table><tbody>${[['score.single',100],['score.double',300],['score.triple',500],['score.quad',800],['score.tspinSingle',800],['score.tspinDouble',1200],['score.tspinTriple',1600]].map(([key,num])=>`<tr><th>${label(key)}</th><td>${num}</td></tr>`).join('')}</tbody></table><p>${label('score.bonuses')}</p></details>`;
  }
  function itemName(item){return t(item.kind==='consumable'?`item.${item.id}`:`${item.category==='theme'?'theme':item.category}.${item.value}`);}
  function renderShop(){
    const a=getAppearance();
    const cards=category=>CATALOG.filter(item=>item.category===category||category==='items'&&item.kind==='consumable').map(item=>{
      const cosmetic=item.kind==='cosmetic',has=cosmetic&&owned(item.id),active=cosmetic&&a[item.category]===item.value,color=THEMES[item.value]?.accent||THEMES[a.theme].accent,quantity=profile()?.inventory?.find(row=>row.itemId===item.id)?.quantity||0;
      return `<article class="srg-shop-card ${active?'is-selected':''}"><div class="srg-swatch ${esc(item.category||'item')} ${esc(item.value||item.id)}" style="--swatch:${esc(color)}">${category==='theme'?'<i></i><i></i><i></i>':cosmetic?'<b>✦</b>':({shield:'◇',cleanse:'✧',pulse:'↗'}[item.id])}</div><h4>${esc(itemName(item))}</h4><p>${has?label('shop.owned'):item.free?label('shop.free'):`◈ ${item.price}`}${!cosmetic?` · ${label('shop.inventory')} ${quantity}`:''}</p><div class="srg-card-actions">${cosmetic?`<button type="button" class="srg-button" data-preview="${esc(item.id)}">${label('shop.preview')}</button>`:''}<button type="button" class="srg-button ${has?'':'srg-primary'}" data-${has?'equip':'buy'}="${esc(item.id)}" ${active&&has?'disabled':''}>${label(has?active?'shop.equipped':'shop.equip':'shop.buy')}${!has?' · '+item.price:''}</button></div></article>`;
    }).join('');
    return `<div class="srg-appearance-preview"><canvas width="160" height="210" aria-label="${label('appearance.preview')}"></canvas><div><p class="srg-kicker">MAKE IT YOUR REALM</p><h3>${label('appearance.title')}</h3><p>${label('appearance.layers')}</p>${previewBase?`<strong class="srg-preview-tag">${label('shop.previewOnly')}</strong>${button('shop.endPreview','end-preview')}`:''}</div></div><div class="srg-shop-filters" role="group">${[['theme','appearance.theme'],['blocks','appearance.blocks'],['board','appearance.board'],['background','appearance.background'],['items','shop.items']].map(([id,key])=>`<a href="#shop-${id}">${label(key)}</a>`).join('')}</div>${!signedIn()?`<p class="srg-muted">${label('shop.guestNote')}</p>`:''}${[['theme','appearance.theme'],['blocks','appearance.blocks'],['board','appearance.board'],['background','appearance.background'],['items','shop.items']].map(([id,key])=>`<section class="srg-shop-section" id="shop-${id}"><h3>${label(key)}</h3>${id==='items'?`<p class="srg-muted">${label('shop.partyOnly')}</p>`:''}<div class="srg-shop-grid">${cards(id)}</div></section>`).join('')}`;
  }
  function peerRow(peer,kind){return `<div class="srg-peer"><span class="srg-peer-avatar">${esc(peer.nickname.slice(0,1))}</span><div><strong translate="no">${esc(peer.nickname)}</strong><code>${esc(peer.friendCode)}</code></div><div class="srg-peer-actions">${kind==='request'&&peer.direction==='incoming'?`<button class="srg-button srg-primary" data-friend="accept" data-id="${esc(peer.requestId)}">${label('friends.accept')}</button>`:''}${kind==='blocked'?`<button class="srg-button" data-unblock="${esc(peer.id)}">${label('friends.unblock')}</button>`:`<button class="srg-button" data-friend="${kind==='friend'?'remove':'decline'}" data-id="${esc(peer.requestId)}">${label(kind==='friend'?'friends.remove':peer.direction==='outgoing'?'common.cancel':'friends.decline')}</button><button class="srg-button" data-block="${esc(peer.id)}">${label('friends.block')}</button>`}</div></div>`;}
  function renderFriends(){
    if(!signedIn())return requireAccount();
    return `<div class="srg-friend-code"><span>${label('friends.myCode')}</span><code>${esc(profile()?.profile?.friendCode||'—')}</code>${button('common.copy','copy-code')}</div><form data-form="friend" class="srg-inline-form">${field('friends.code','friendCode','text','minlength="12" maxlength="12" autocapitalize="characters" autocomplete="off" spellcheck="false"')}<button class="srg-button srg-primary" type="submit">${label('friends.add')}</button></form><p class="srg-muted">${label('friends.privacy')}</p><h3>${label('friends.requests')}</h3>${friends?.requests?.length?friends.requests.map(x=>peerRow(x,'request')).join(''):`<p class="srg-muted">${label('friends.noRequests')}</p>`}<h3>${label('friends.title')}</h3>${friends?.friends?.length?friends.friends.map(x=>peerRow(x,'friend')).join(''):`<p class="srg-empty">${label('friends.empty')}</p>`}<details class="srg-details"><summary>${label('friends.blocked')}</summary>${friends?.blocked?.map(x=>peerRow(x,'blocked')).join('')||`<p>${label('common.empty')}</p>`}</details>`;
  }
  function renderRanked(){
    const p=profile(),rank=p?.rank;
    return `<div class="srg-rank-hero"><span>♜</span><div><p class="srg-kicker">SEASON 0 · ONLINE BETA</p><h3>${label('rank.'+(rank?.tier||'silver'))} <b>${rank?.rating??1000}</b></h3><p>${rank?.provisional!==false?label('ranked.placements'):label('ranked.rated')}</p></div></div><p>${label('ranked.rules')}</p><p class="srg-notice">${label('ranked.betaNote')}</p>${signedIn()?button('ranked.join','play-ranked'):requireAccount()}<div class="srg-info-grid"><article><h3>${label('ranked.record')}</h3><p>${rank?.wins||0} W · ${rank?.losses||0} L · ${rank?.draws||0} D</p></article><article><h3>${label('ranked.fairPlay')}</h3><p>${label('ranked.noItems')}</p></article></div><h3>${label('ranked.leaderboard')}</h3>${leaderboard?.entries?.length?`<ol class="srg-leaderboard">${leaderboard.entries.map(row=>`<li><span translate="no">${esc(row.nickname)}</span><strong>${row.rating}</strong></li>`).join('')}</ol>`:`<p class="srg-muted">${label('ranked.noLeaderboard')}</p>`}<h3>${label('ranked.history')}</h3>${history?.matches?.length?`<div class="srg-history">${history.matches.slice(0,10).map(row=>`<div><span>${esc(row.opponent?.nickname||row.opponentNickname||t('ranked.opponent'))}<small>${esc(new Date(row.createdAt).toLocaleDateString(getLocale()))}</small></span><b>${label('ranked.'+row.outcome)} · ${row.ratingAfter}</b></div>`).join('')}</div>`:`<p class="srg-muted">${label('common.empty')}</p>`}`;
  }
  function renderPlus(){
    const plus=profile()?.entitlement?.plus===true,custom=getCustomImageState();
    return `<div class="srg-plus-hero"><p class="srg-kicker">SNOWREALM PLUS</p><h3>${label('subscription.headline')}</h3><p>${label('subscription.pitch')}</p><div class="srg-pricing"><strong>US$${MEMBERSHIP.proposedMonthlyUsd}</strong><span>${label('subscription.perMonth')}</span><small>US$${MEMBERSHIP.proposedYearlyUsd} / ${label('subscription.perYear')}</small></div><span class="srg-preview-tag">${label(plus?'subscription.active':'subscription.proposed')}</span></div><ul class="srg-benefits"><li>${label('subscription.customImages')}</li><li>${label('subscription.syncStyles')}</li><li>${label('subscription.noAdvantage')}</li></ul><button class="srg-button srg-primary" type="button" disabled>${label(plus?'subscription.active':'subscription.unavailable')}</button><p class="srg-muted">${label('subscription.billingNote')}</p><section class="srg-image-section"><h3>${label('subscription.imageTitle')}</h3><p>${label('subscription.imageNote')}</p><label class="srg-field"><span>${label('appearance.target')}</span><select id="customImageTarget"><option value="background" ${getAppearance().customTarget==='background'?'selected':''}>${label('appearance.background')}</option><option value="board" ${getAppearance().customTarget==='board'?'selected':''}>${label('appearance.board')}</option></select></label><label class="srg-file"><input type="file" accept="image/png,image/jpeg,image/webp" id="customImageFile"><span>${label(plus?'subscription.chooseImage':'subscription.previewImage')}</span></label><label class="srg-field"><span>${label('appearance.overlay')}</span><input id="customImageOverlay" type="range" min="48" max="92" step="1" value="${Math.round(getAppearance().boardOverlay*100)}"></label><p class="srg-muted">${label('subscription.privateImage')}</p>${custom.preview?`<p class="srg-preview-tag">${label('shop.previewOnly')}</p>`:''}${button('appearance.removeImage','remove-image')}${button('shop.endPreview','end-preview')}<p class="srg-small">${label('subscription.imageRights')}</p></section>`;
  }
  function drawPreview(){const canvas=content.querySelector('.srg-appearance-preview canvas');if(!canvas)return;const ctx=canvas.getContext('2d');drawBoardBackground(ctx,160,210,{columns:10,rows:13});for(const[x,y,color]of[[3,3,'#bf91ff'],[2,4,'#bf91ff'],[3,4,'#bf91ff'],[4,4,'#bf91ff'],[1,11,'#62e9ed'],[2,11,'#62e9ed'],[3,11,'#62e9ed'],[4,11,'#62e9ed'],[6,10,'#f5d769'],[7,10,'#f5d769'],[6,11,'#f5d769'],[7,11,'#f5d769']])drawBlock(ctx,x*16,y*16,16,color,{active:true});}
  function render(){
    renderToolbar();if(!dialog.open)return;
    dialog.querySelector('#memberTitle').textContent=t(navs.find(x=>x[0]===page)[1]);
    dialog.querySelector('.srg-member-nav').innerHTML=navs.map(([id,key,icon])=>`<button type="button" data-member-page="${id}" class="${page===id?'active':''}" aria-pressed="${page===id}"><span aria-hidden="true">${icon}</span>${label(key)}</button>`).join('');
    content.innerHTML=({account:renderAccount,wallet:renderWallet,shop:renderShop,friends:renderFriends,ranked:renderRanked,plus:renderPlus}[page])();drawPreview();
  }
  async function loadPage(){
    if(!signedIn())return;
    const p=page;
    try{if(p==='friends')friends=await api('/v1/friends');if(p==='wallet'){
      const userId=memberState().user.id;
      const [wallet,missions,reward]=await Promise.all([api('/v1/wallet/history'),api('/v1/quests/daily').catch(()=>null),api('/v1/ads/rewarded/status').catch(()=>null)]);
      if(memberState().user?.id!==userId)return;
      walletHistory=wallet;quests=missions;rewardStatus=reward?{...reward,userId}:null;
    }if(p==='ranked'){leaderboard=await api('/v1/leaderboard');if(signedIn())history=await api('/v1/matches/history');}if(page===p)render();}
    catch(error){if(page===p)errorMessage(error);}
  }
  function open(next='account'){beforeOpen();page=next;if(!dialog.open)dialog.showModal();message('');render();void loadPage();}
  function finishPreview(){if(previewBase){setAppearance(previewBase);previewBase=null;}clearCustomPreview();}
  function close(){dialog.close();}
  async function run(task){if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');message('common.loading');try{await task();}catch(error){errorMessage(error);}finally{busy=false;dialog.removeAttribute('aria-busy');}}
  toolbar.addEventListener('click',event=>{const b=event.target.closest('[data-member-open]');if(b)open(b.dataset.memberOpen);});
  toolbar.querySelector('[data-locale]').addEventListener('change',event=>{setLocale(event.target.value);if(signedIn())void patchProfile({locale:({'zh-TW':'zh-Hant','zh-CN':'zh-Hans'}[getLocale()]||getLocale())}).catch(()=>{});});
  dialog.addEventListener('close',()=>{finishPreview();afterClose();});
  dialog.addEventListener('click',event=>{
    const pageButton=event.target.closest('[data-member-page]');if(pageButton){page=pageButton.dataset.memberPage;message('');render();void loadPage();return;}
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.preview){const item=CATALOG.find(x=>x.id===b.dataset.preview);if(!previewBase)previewBase=getAppearance();setAppearance({[item.category]:item.value},{persist:false});render();message('shop.previewOnly');return;}
    if(b.dataset.equip){void run(async()=>{const item=CATALOG.find(x=>x.id===b.dataset.equip);finishPreview();if(signedIn())await patchProfile({appearance:{[item.category]:item.value}});else setAppearance({[item.category]:item.value});render();message('shop.applied');});return;}
    if(b.dataset.buy){if(!signedIn()){authMode='login';open('account');return;}void run(async()=>{const itemId=b.dataset.buy;await economyAction('/v1/shop/purchase',{itemId,quantity:1},'buy:'+itemId);render();message('shop.purchased');});return;}
    if(b.dataset.questClaim){void run(async()=>{await economyAction('/v1/quests/daily/claim',{questId:b.dataset.questClaim},'quest:'+b.dataset.questClaim);await loadPage();render();message('quests.rewardReceived');});return;}
    if(b.dataset.friend){void run(async()=>{await api(`/v1/friends/requests/${b.dataset.id}/${b.dataset.friend}`,{method:'POST',body:{}});await loadPage();message('common.saved');});return;}
    if(b.dataset.block||b.dataset.unblock){void run(async()=>{await api('/v1/friends/block',{method:b.dataset.block?'POST':'DELETE',body:{userId:b.dataset.block||b.dataset.unblock}});await loadPage();message('common.saved');});return;}
    const action=b.dataset.memberAction;
    if(action==='close'){close();return;}
    if(['login','register','forgot'].includes(action)){authMode=action==='forgot'?'reset':action;page='account';render();message('');return;}
    if(action==='end-preview'){finishPreview();render();message('shop.previewEnded');return;}
    if(action==='play-ranked'){close();if(onRanked)onRanked();else location.href=new URL('./index.html?mode=ranked',import.meta.url).href;return;}
    if(action==='copy-code'){void run(async()=>{await navigator.clipboard.writeText(profile()?.profile?.friendCode||'');message('common.copied');});return;}
    if(action==='logout')void run(async()=>{await signOut();friends=history=walletHistory=quests=rewardStatus=null;render();message('account.loggedOut');});
    if(action==='refresh')void run(async()=>{await refreshProfile();render();message('common.saved');});
    if(action==='plus-reward')void run(async()=>{
      await economyAction('/v1/ads/rewarded/plus-claim',{});
      await loadPage();message('ads.plusReceived');
    });
    if(action==='daily')void run(async()=>{await economyAction('/v1/wallet/daily',{});await loadPage();render();message('wallet.dailyReceived');});
    if(action==='resend'||action==='send-reset')void run(async()=>{const input=content.querySelector('[name="email"]');if(!input.reportValidity())return;email=input.value.trim();if(action==='resend')await sendVerification(email);else await requestPasswordReset(email);message('account.codeSent');});
    if(action==='remove-image')void run(async()=>{await clearCustomImage();if(signedIn())await patchProfile({appearance:{customBackgroundEnabled:false}});render();message('common.saved');});
  });
  dialog.addEventListener('submit',event=>{event.preventDefault();const form=event.target,data=new FormData(form);if(!form.reportValidity())return;
    void run(async()=>{
      if(form.dataset.form==='profile'){await patchProfile({nickname:data.get('nickname')});render();message('common.saved');}
      if(form.dataset.form==='friend'){await api('/v1/friends/requests',{method:'POST',body:{friendCode:String(data.get('friendCode')).trim().toUpperCase()}});await loadPage();message('friends.sent');}
      if(form.dataset.form==='auth'){
        email=String(data.get('email')).trim();
        if(authMode==='register'){await signUp(email,data.get('password'),data.get('nickname'));authMode='verify';render();message('account.verifySent');}
        else if(authMode==='verify'){const signed=await verifyEmail(email,data.get('otp'));if(!signed)authMode='login';render();message(signed?'account.loggedIn':'account.verified');}
        else if(authMode==='reset'){await resetPassword(email,data.get('otp'),data.get('password'));authMode='login';render();message('account.passwordReset');}
        else {try{await signIn(email,data.get('password'));render();message('account.loggedIn');}catch(error){if(error.code==='EMAIL_NOT_VERIFIED'){authMode='verify';render();message('account.verifySent');}else throw error;}}
      }
    });
  });
  dialog.addEventListener('change',event=>{
    if(event.target.id==='customImageFile'&&event.target.files[0])void run(async()=>{const plus=profile()?.entitlement?.plus===true;if(!previewBase)previewBase=getAppearance();const target=content.querySelector('#customImageTarget').value;await setCustomImage(event.target.files[0],{target,preview:!plus,persist:plus});if(plus){await patchProfile({appearance:{customTarget:target,customBackgroundEnabled:true}});previewBase=null;}render();message(plus?'common.saved':'shop.previewOnly');});
    if(event.target.id==='customImageTarget'){setAppearance({customTarget:event.target.value},{persist:false});}
    if(event.target.id==='customImageOverlay'){const boardOverlay=Number(event.target.value)/100;setAppearance({boardOverlay},{persist:!previewBase});if(profile()?.entitlement?.plus)void patchProfile({appearance:{boardOverlay}}).catch(errorMessage);}
  });
  subscribeMember(()=>{renderToolbar();if(dialog.open&&!(page==='account'&&!signedIn()))render();});
  subscribeLocale(()=>{renderToolbar();if(dialog.open)render();});
  applyAppearance();void initMember();renderToolbar();
  return {open,close,render};
}
