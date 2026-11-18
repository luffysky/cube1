# SnowRealm Games：PWA 與離線基礎

## 目前交付範圍

這一版提供根路徑的 Web App Manifest、原創雪花圖示、Service Worker，以及安裝／更新的前端控制。

完整資源成功驗證並儲存後，預期可離線開啟平台與旋界的本機 CPU、道具派對、自由練習、T-Spin 道場，以及本機音效／背景音樂。52 Hunt 與 Next Floor 只快取目前的開發介紹頁，不表示其遊戲已完成。`/studio/` 商業工作台不在離線範圍內。

**程式與隔離測試完成，不等於已通過實機安裝驗證。** 尤其目前 Sites 的私人登入閘門可能影響 Service Worker 註冊、子資源擷取，以及 iOS「加入主畫面」後的登入與儲存環境。發布後仍須使用實際登入帳號、Safari／Chrome 與安裝後的獨立視窗驗證。

## 整合約定

根頁需要以下內容：

```html
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0b1118">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
<body data-srg-page="platform">
<!-- … -->
<script type="module" src="/pwa.mjs"></script>
```

需要安裝與更新入口時，提供 `id="installApp"` 與 `id="applyUpdate"` 的按鈕。後者與可選的父層 `id="updateBanner"` 由腳本管理顯示狀態；`id="offlineState"` 可顯示「離線資源已就緒／尚未就緒」。

各頁面的 body 標記必須完全符合：

| 路徑 | `data-srg-page` |
| --- | --- |
| `/index.html` | `platform` |
| `/games/spinrealm/index.html` | `spinrealm` |
| `/games/52hunt/index.html` | `52hunt` |
| `/games/next-floor/index.html` | `next-floor` |

如需從旋界直接造訪時也啟動 PWA 準備，`platform-bridge.mjs` 可 import `/pwa.mjs`；沒有安裝／更新按鈕時仍可安全執行。

平台提示透過事件傳出，PWA 不會自行插入彈窗或遊戲 UI：

```js
window.addEventListener('srg:notice', event => {
  showToast(event.detail.message);
});
window.addEventListener('srg:offline-status', event => {
  // event.detail = { ready: boolean, version: string }
});
```

`document.documentElement.dataset.offlineReady` 同樣反映最近一次完整快取檢查結果。不能把單純註冊成功、`appinstalled` 或安裝圖示出現當成離線資源已完整儲存。

## 快取界線與登入頁防護

`sw.js` 使用明確的同源資源白名單。目前版本為 `2026-11-18-v8`。平台 CSS／JS、PWA 檔、四張封面／標記 SVG、PNG 圖示、四個 HTML 頁，以及旋界引擎和橋接檔會預先快取。也納入 `arena-layout.css`、`party.mjs`、`sound.mjs`，以及 `audio/` 內的 10 個 WAV、1 個 MP3、`credits.json` 和 `LICENSES.txt`，共 13 個音訊／來源檔，約 2.48 MB。沒有廣泛的「快取本站所有 GET」規則。

下列請求完全不由這個離線殼層接管：

- `/studio/`、API、登入、登出及 callback 路徑。
- 任意非白名單路徑與外部網域。
- POST 等非 GET 請求，以及帶 query 的 URL。
- HTML、非音訊資源與非白名單路徑的 Range 請求。只有明確列入 `ASSETS` 的 WAV／MP3 有下述例外。

每個安裝資源都必須回傳 200、正確 Content-Type、同源且完全符合預期的最終 URL，並且沒有重新導向。HTML 還必須含有對應的 body 標記；這能拒絕「原 URL 回傳 200，但內容其實是登入頁」的情況。JS／CSS／文字來源檔也拒絕明顯被錯誤 MIME 包裝的 HTML；Manifest 和 JSON 來源資料還需能解析為 JSON。

WAV 接受 `audio/wav`、`audio/x-wav`、`audio/wave` 或 `audio/vnd.wave`；MP3 必須是 `audio/mpeg`。音訊會再檢查 RIFF/WAVE 或 ID3／MPEG frame 標頭，因此帶著音訊 MIME 的登入 HTML 也不能混進快取。這是容器標頭檢查，不是完整解碼或聽感驗收。

完整 GET 音訊原本就能從離線快取取得，但 HTMLAudio 播放器可能使用 Range 分段讀取；只快取整個檔案不足以涵蓋這條播放路徑。v8 對白名單 WAV／MP3 的 Range 請求，重新驗證完整快取回應後才切片。支援 `bytes=0-99`、`bytes=100-` 與 `bytes=-100`，回傳 206 和正確的 `Content-Range`、`Accept-Ranges`、`Content-Length`。非法、無法滿足或多段 Range 回傳 416；`If-Range` 則保守地忽略分段，回傳已驗證的完整 200 回應。完整原檔會保留在快取，不寫入 206 片段。

若快取音檔缺失、不是完整 200、URL／MIME 不符，或內容其實是 HTML，就送出原網路請求，不會把它切成偽裝音訊。網路回覆的登入頁或拒絕存取狀態保持原樣；若此時離線，請求會失敗。已完成完整快取的正常音檔則可離線供播放器讀取與跳播。

只要任何必要資源失敗，這次安裝會失敗並刪除不完整的版本快取。舊的有效版本可繼續使用；前端收到錯誤提示，不會宣稱新版本已準備好。

線上導覽會先走網路，保留登入重新導向、403 等拒絕存取和其他 HTTP 錯誤；這些回應不會被替換成遊戲頁，也不會進快取。網路確認回應是可信遊戲頁後，使用已安裝版本的 HTML，確保它和該版本的 JS／CSS 配套。只有擷取拋出網路錯誤時，才對白名單頁面嘗試離線副本。

瀏覽器的 fetch 錯誤本身無法完整區分斷網與所有跨來源／閘門錯誤，因此這不是帳號授權機制。離線快取只包含已獲取的靜態遊戲程式，不包含帳號、商業資料或 API 回應。已下載的靜態程式會留在裝置上，直到網站資料被清除；Service Worker 不取代 Sites 存取政策。

## 不打斷對局的更新方式

安裝事件不呼叫 `skipWaiting()`，也不要求頁面自動重新載入。

新版本準備好後，前端顯示更新入口。只有使用者在平台首頁主動按下更新，才會提出啟用請求。等待中的 Worker 會再次確認來源是本站首頁、快取完整，並檢查同源是否仍開著 `/games/` 分頁；有遊戲分頁就拒絕提前啟用。

啟用後，只有提出更新的那個平台分頁會重新載入一次。其他分頁即使收到 `controllerchange`，也不會因此重新載入。這個保護刻意保守：即使遊戲已結束，只要分頁仍在遊戲路徑，也會請使用者先關閉該分頁。

瀏覽器仍可依標準生命週期，在所有舊版本控制頁面都關閉後自然啟用等待版本。

## 發布與版本維護

1. 每當白名單內任一檔案改變，更新 `sw.js` 的 `VERSION`；不能只替換 HTML 或 JS 而保留相同 Worker 內容。
2. 以同一份發布產物一起部署 Worker、Manifest、HTML、JS、CSS、音訊與圖示。
3. 保留 Worker 在根路徑 `/sw.js`，註冊 scope 為 `/`；不需要擴大其他路徑的 Service-Worker-Allowed 權限。
4. 確認主機對 `.mjs`、`.css`、`.webmanifest`、PNG、SVG、WAV、MP3、JSON 與純文字回傳正確 MIME，HTML 具有指定標記。
5. 登入閘門若將資源改導向，應先排查部署／登入行為；不要為了通過預快取而取消 HTML 標記、最終 URL 或 MIME 驗證。

`scripts/sync-spinrealm.mjs` 會在複製前確認完整的旋界入口／模組／CSS 與音訊目錄已備齊，再遞迴複製 `dist/audio/`，並同步包含 `party.test.mjs` 的遊戲測試與其相對 import。它不會自動修改 SW 白名單；新增、移除或改名音訊時，需一起更新 v6 之後版本的明確資源清單。同步完成不代表已通過測試或發布。

作業系統與瀏覽器可能清理儲存空間；快取不具有永久保留保證。完整性查詢發現檔案缺少時會撤銷 ready 狀態，而不是補入可能屬於不同版本的零散模組。重新建立快取可透過完整的新版本安裝；必要時清除本站資料後，連網重新開啟平台。清除本站資料也可能清除本機遊戲設定與紀錄，操作前應提醒使用者。

## 已完成的程式測試

```sh
node --test tests/pwa.test.mjs
```

測試使用隔離的 Service Worker／Cache／頁面事件環境，涵蓋：

- 完整快取後的平台與旋界離線回應。
- 認證、API、工作台、外部 URL、query 及非 GET 的排除範圍。
- 同 URL 登入頁、重新導向、錯誤最終 URL／MIME 與偽裝 JS 的拒收。
- WAV／MP3 的完整離線取得、常見 WAV MIME，以及音訊／來源檔偽裝登入 HTML 的拒收。
- 離線音訊的完整範圍、開放結尾與後綴 Range；精確的 206 內容／標頭，非法與多段 Range 的 416，以及 HTML／未知路徑保持 bypass。
- 分段讀取前重驗快取；缺失、不完整或偽裝音訊不會變成 206，網路授權錯誤保持原樣。
- 安裝失敗清理、線上授權錯誤不被離線頁覆蓋。
- 同一版本 HTML／JS 的使用與資源被清除後的 ready 撤銷。
- 更新的來源、遊戲分頁和完整性檢查，以及非自願更新不重載頁面。
- Manifest 路徑與實際 PNG 尺寸。

這些測試沒有模擬 Sites 真實登入、瀏覽器儲存淘汰策略、裝置桌面安裝或真實斷網；不得將通過結果描述為已完成實機 PWA 驗收。

## 發布後的必要實機驗證

以已登入的發布 URL 開啟平台，確認沒有註冊錯誤，等待完整的離線準備結果；安裝或加入主畫面後再開啟一次。關閉網路，重新開啟平台並進入旋界，實際操作 CPU、自由練習與道場，確認沒有缺少模組或素材。

另開一個旋界分頁，在平台遇到新版本時按更新，應被擋下；關閉遊戲分頁後更新，只有操作更新的主頁重載。再測登入失效或未登入情況，確認登入頁不會被記為離線遊戲，工作台與 API 沒有離線替代回應。

## 參考

- MDN：Service Worker [skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting)
- W3C：[Service Worker lifecycle explainer](https://github.com/w3c/ServiceWorker/blob/main/explainer.md)
- Chrome Developers：[Handling service worker updates](https://developer.chrome.com/docs/workbox/handling-service-worker-updates)

本實作未引入 Workbox；以上用於確認瀏覽器更新生命週期與使用者主動接受更新的設計。
