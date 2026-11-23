import { initLocalization } from '../games/spinrealm/i18n.mjs';
import { initMemberUI } from '../games/spinrealm/member-ui.mjs';
import { api, memberState, subscribeMember } from '../games/spinrealm/member-client.mjs';

const games = [
  ['spinrealm', '旋界', '排位、對局與道具', 'spinrealm'],
  ['brickduel', '轉磚對戰', '冒險進度與雲端存檔', 'brickduel'],
  ['52hunt', '52 HUNT', '身分與對局', 'hunt'],
  ['next-floor', 'NEXT FLOOR 下一層', '探索進度', 'floor'],
  ['zero-dodge', '零界閃避', '生存紀錄'],
  ['refract-maze', '折光迷陣', '解謎進度'],
  ['territory-conquest', '領域爭奪', '領地與對戰'],
  ['gravity-reversal', '重力逆轉', '挑戰紀錄'],
  ['orbit-escape', '環域逃脫', '逃脫紀錄'],
  ['beat-overdrive', '節奏超載', '歌曲與分數'],
];
const titles = {overview:'總覽', games:'我的遊戲', wallet:'錢包與交易', billing:'訂單與帳單', account:'帳號與資料'};
const view = document.querySelector('#view');
const status = document.querySelector('#view-status');
const shell = document.querySelector('#dashboard');
const sessionStatus = document.querySelector('#session-status');
const number = new Intl.NumberFormat('zh-TW');
const date = new Intl.DateTimeFormat('zh-TW', {dateStyle:'medium',timeStyle:'short'});
let renderVersion = 0;
let pending;

function node(tag, value, className) {
  const element = document.createElement(tag);
  if (value != null) element.textContent = value;
  if (className) element.className = className;
  return element;
}
function link(label, href) {
  const element = node('a', label, 'action');
  element.href = href;
  return element;
}
function card(label,value) {
  const element = node('div', null, 'card');
  element.append(node('h3',label), node('p',value ?? '—','metric'));
  return element;
}
function cards(...items) {
  const element = node('div',null,'cards');
  element.append(...items);
  view.append(element);
}
function table(title, headings, rows, empty) {
  view.append(node('h3',title));
  if (!rows.length) { view.append(node('p',empty)); return; }
  const wrap = node('div',null,'table-wrap');
  const list = node('table');
  const header = list.createTHead().insertRow();
  for (const heading of headings) {
    const cell = node('th',heading);
    cell.scope = 'col';
    header.append(cell);
  }
  const body = list.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) row.insertCell().textContent = value;
  }
  wrap.append(list);
  view.append(wrap);
}
function time(value) {
  const timestamp = new Date(value);
  return value && Number.isFinite(timestamp.getTime()) ? date.format(timestamp) : '—';
}
function gameCard([id,name,description,cover]) {
  const element = node('article',null,'card');
  if (cover) {
    const image = node('img');
    image.src = '/assets/' + cover + '-cover.svg';
    image.alt = '';
    image.loading = 'lazy';
    element.append(image);
  }
  element.append(node('h3',name),node('p',description),link('查看遊戲資料', '#game/' + id));
  return element;
}
function spinrealm(data) {
  const {rank, inventory} = data;
  cards(card('排位分數',number.format(rank.rating)),card('排位對局',number.format(rank.games)),
    card('勝 / 敗 / 和',[rank.wins,rank.losses,rank.draws].map(value=>number.format(value)).join(' / ')));
  table('持有道具',['道具','數量'],inventory.map(item=>[item.itemId,number.format(item.quantity)]),'目前沒有道具。');
}
function download(data) {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const file = node('a');
  file.href = url;
  file.download = 'snowrealm-player-data.json';
  file.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function render() {
  const version = ++renderVersion;
  pending?.abort();
  pending = new AbortController();
  const {ready,user,profile,error} = memberState();
  shell.hidden = !user;
  sessionStatus.hidden = Boolean(user);
  sessionStatus.textContent = ready
    ? error ? '暫時無法確認帳號。請重新整理，或使用上方帳號選單登入。' : '請使用上方帳號選單登入，查看你的遊戲資料。'
    : '正在確認登入狀態…';
  view.replaceChildren();
  status.textContent = '';
  if (!user) return;
  const route = location.hash.slice(1);
  const game = games.find(([id])=>route === 'game/' + id);
  const page = game ? 'games' : Object.hasOwn(titles,route) ? route : 'overview';
  for (const item of document.querySelectorAll('#player-nav a')) {
    if (item.hash === '#' + page) item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  }
  const title = node('h2',game?.[1] ?? titles[page]);
  title.id = 'view-title';
  view.append(title);
  try {
    if (game) {
      const [id,,description] = game;
      const brickduel = id === 'brickduel';
      if (id === 'spinrealm') {
        status.textContent = '載入旋界資料…';
        const data = profile ?? await api('/v1/profile',{signal:pending.signal});
        const history = await api('/v1/matches/history',{signal:pending.signal});
        if (version !== renderVersion) return;
        spinrealm(data);
        table('最近 30 場排位對局',['時間','對手','結果','得分'],
          history.matches.map(match=>[time(match.createdAt),match.opponent.nickname,
            ({win:'勝',loss:'敗',draw:'和'})[match.outcome] ?? match.outcome,number.format(match.score)]),'目前沒有排位紀錄。');
      } else if (brickduel) {
        status.textContent = '載入轉磚存檔…';
        const {save, available} = await api('/v1/games/brickduel/save',{signal:pending.signal}).then(
          data => ({...data, available:true}),
          error => { if (error.status !== 503) throw error; return {available:false}; }
        );
        if (version !== renderVersion) return;
        if (save) {
          const {state} = save;
          cards(card('存檔代號',save.publicTag),card('轉磚金幣',number.format(state.coins)),
            card('排位分數',number.format(state.rp)),card('磚之冒險最高關卡',state.rpg.best ?? 0));
          view.append(node('p','最後同步 ' + time(save.syncedAt)));
        } else {
          view.append(node('p',available ? '目前沒有已同步的轉磚存檔。' : '目前無法讀取轉磚存檔，請前往轉磚查看。'));
        }
      } else {
        view.append(node('h3',description),node('p','這款遊戲的個人紀錄尚未接入玩家中心。'));
      }
      view.append(link(brickduel ? '前往轉磚對戰' : '前往遊戲',brickduel ? 'https://brickduel.snowrealm.pet/' : '/games/' + id + '/'));
    } else if (page === 'games') {
      cards(...games.map(gameCard));
    } else if (page === 'billing') {
      const data = profile ?? await api('/v1/profile',{signal:pending.signal});
      if (version !== renderVersion) return;
      cards(card('平台會員方案',data.entitlement.plus ? 'SnowRealm Plus' : '免費會員'),
        card('會員效期',data.entitlement.plus ? time(data.entitlement.expiresAt) : '—'));
      view.append(node('p','平台帳單與付款憑證尚未接入。遊戲金幣明細可在錢包查詢。'),link('查看錢包','#wallet'));
    } else if (page === 'wallet') {
      status.textContent = '載入錢包…';
      const data = profile ?? await api('/v1/profile',{signal:pending.signal});
      const ledger = await api('/v1/wallet/history',{signal:pending.signal});
      if (version !== renderVersion) return;
      cards(card('旋界金幣',number.format(data.wallet.balance)));
      const reasons = {initial_grant:'初始贈送',daily:'每日獎勵',purchase:'商城消費',ranked_reward:'排位獎勵'};
      table('最近 50 筆旋界金幣交易',['時間','原因','變動','餘額'],
        ledger.entries.map(entry=>[time(entry.createdAt),reasons[entry.reason] ?? entry.reason,
          (entry.delta > 0 ? '+' : '') + number.format(entry.delta),number.format(entry.balanceAfter)]),'目前沒有交易紀錄。');
    } else if (page === 'account') {
      const data = profile ?? await api('/v1/profile',{signal:pending.signal});
      if (version !== renderVersion) return;
      cards(card('暱稱',data.profile.nickname),card('電子郵件',user.email),
        card('好友代碼',data.profile.friendCode),card('加入時間',time(data.profile.createdAt)));
      const edit = node('button','開啟帳號設定','action');
      edit.type = 'button';
      edit.onclick = ()=>memberUI.open('account');
      const exportButton = node('button','下載目前可查的資料','action');
      exportButton.type = 'button';
      exportButton.onclick = async ()=>{
        exportButton.disabled = true;
        try {
          const [wallet,ranked] = await Promise.all([api('/v1/wallet/history'),api('/v1/matches/history')]);
          if (version === renderVersion) download({account:{email:user.email},spinrealm:{...data,walletHistory:wallet.entries,matches:ranked.matches}});
        } catch {
          if (version === renderVersion) status.textContent = '資料下載失敗，請重試。';
        } finally { exportButton.disabled = false; }
      };
      view.append(node('p','下載包含帳號資料、旋界玩家資料及近期金幣與對局紀錄。'),edit,' ',exportButton);
    } else {
      const data = profile ?? await api('/v1/profile',{signal:pending.signal});
      if (version !== renderVersion) return;
      cards(card('玩家',data.profile.nickname),card('旋界金幣',number.format(data.wallet.balance)),
        card('旋界排位分數',number.format(data.rank.rating)));
      view.append(node('h3','遊戲'));
      cards(...games.slice(0,2).map(gameCard));
    }
    if (version === renderVersion) status.textContent = '';
  } catch {
    if (version !== renderVersion) return;
    status.textContent = '目前無法載入資料。';
    const retry = node('button','重試','action');
    retry.type = 'button';
    retry.onclick = render;
    view.append(retry);
  }
}
initLocalization();
const memberUI = initMemberUI();
subscribeMember(render);
window.addEventListener('hashchange',render);
