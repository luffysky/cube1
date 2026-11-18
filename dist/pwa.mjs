// Optional platform hooks: #installApp, #applyUpdate, and srg:notice events.
const installButton = document.getElementById('installApp');
const updateButton = document.getElementById('applyUpdate');
const updateBanner = document.getElementById('updateBanner');
const offlineLabel = document.getElementById('offlineState');
let installEvent = null;
let registration = null;
let updateRequested = false;
let reloading = false;
let lastReady = null;

function notice(message) {
  window.dispatchEvent(new CustomEvent('srg:notice', { detail: { message } }));
}
function standalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
function onPlatform() {
  return document.body?.dataset.srgPage === 'platform' && ['/', '/index.html'].includes(location.pathname);
}
function showInstallState() {
  if (!installButton) return;
  installButton.hidden = standalone();
  installButton.dataset.installable = String(Boolean(installEvent));
}
function showUpdate() {
  if (updateBanner) updateBanner.hidden = false;
  if (updateButton) { updateButton.hidden = false; updateButton.disabled = false; }
  notice('新版已準備好。結束遊戲並回到平台後，可以按「更新」套用。');
}
function workerRequest(worker, message) {
  return new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('No active worker.')); return; }
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close(); channel.port2.close(); reject(new Error('Worker response timed out.'));
    }, 5000);
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(event.data);
    };
    try { worker.postMessage(message, [channel.port2]); }
    catch (error) { clearTimeout(timer); channel.port1.close(); channel.port2.close(); reject(error); }
  });
}
function setReady(ready, version = '') {
  document.documentElement.dataset.offlineReady = String(ready);
  if (offlineLabel) offlineLabel.textContent = ready ? '離線資源已就緒' : '離線資源尚未就緒';
  window.dispatchEvent(new CustomEvent('srg:offline-status', { detail: { ready, version } }));
  if (ready && lastReady !== true) notice('離線資源已儲存。可以關閉網路，試一次旋界的本機練習。');
  lastReady = ready;
}
async function checkReady() {
  try {
    const worker = navigator.serviceWorker.controller || registration?.active;
    if (!worker) { setReady(false); return; }
    const status = await workerRequest(worker, { type: 'SRG_OFFLINE_STATUS' });
    setReady(status?.ready === true, status?.version || '');
  } catch { setReady(false); }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installEvent = event; showInstallState();
});
window.addEventListener('appinstalled', () => {
  installEvent = null; showInstallState(); notice('已加入裝置。旋界的 CPU 和練習模式不需要真人連線。');
});
installButton?.addEventListener('click', async () => {
  if (installEvent) {
    const prompt = installEvent; installEvent = null; showInstallState();
    try { await prompt.prompt(); await prompt.userChoice; } catch { notice('目前無法開啟安裝視窗，請使用瀏覽器的安裝選單。'); }
    return;
  }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  notice(ios ? '使用 Safari 的分享選單，選擇「加入主畫面」。首次開啟請保持連線。' : '請使用瀏覽器選單的「安裝應用程式」或「加入主畫面」；選項由瀏覽器提供。');
});

updateButton?.addEventListener('click', async () => {
  if (!onPlatform()) { notice('先結束這局並回到遊戲平台，再套用更新。'); return; }
  if (!registration?.waiting) { notice('目前沒有等待套用的更新。'); return; }
  updateRequested = true;
  if (updateButton) updateButton.disabled = true;
  try {
    const result = await workerRequest(registration.waiting, { type: 'SRG_ACTIVATE_UPDATE' });
    if (!result?.accepted) {
      updateRequested = false;
      if (updateButton) updateButton.disabled = false;
      notice(result?.reason === 'game-open' ? '還有遊戲分頁開著。先結束並關閉那些分頁，再更新平台。' : '更新尚未就緒，請保持連線後再試一次。');
    }
  } catch {
    updateRequested = false;
    if (updateButton) updateButton.disabled = false;
    notice('更新暫時沒有完成，這個頁面會維持目前版本。');
  }
});

if (updateButton) updateButton.hidden = true;
if (updateBanner) updateBanner.hidden = true;
showInstallState();
setReady(false);

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only the tab whose user accepted an update reloads, and never a game tab.
    if (updateRequested && onPlatform() && !reloading) {
      reloading = true; location.reload();
    } else checkReady();
  });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'SRG_WORKER_ACTIVE') checkReady();
    if (event.data?.type === 'SRG_OFFLINE_ERROR') {
      setReady(false); notice('離線資源沒有完整儲存。請保持連線遊玩，稍後再試。');
    }
  });
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(result => {
    registration = result;
    if (registration.waiting) showUpdate();
    const observe = worker => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && (navigator.serviceWorker.controller || registration.active)) showUpdate();
        if (worker.state === 'activated') checkReady();
        if (worker.state === 'redundant') { setReady(false); notice('離線準備未完成，目前仍可連線使用。'); }
      });
    };
    observe(registration.installing);
    registration.addEventListener('updatefound', () => observe(registration.installing));
    checkReady();
  }).catch(() => {
    setReady(false); notice('這個瀏覽器目前無法準備離線遊戲，請保持連線使用。');
  });
} else {
  setReady(false);
}
