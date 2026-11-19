# SPINREALM WebSocket 好友房（測試版）

## 能做什麼
- 2–4 名玩家使用同一房間碼，在各自瀏覽器一起玩。
- WebSocket 對戰狀態傳輸；Cloudflare Durable Object 每個房間由唯一實例管理。
- `Game` 方塊、分數、消行和攻擊由伺服器判定，客戶端只送合法操作與遞增序列。
- 對手可見棋盤，客戶端可切換棋盤／數據顯示。
- 用於**休閒好友房**，不加入 Neon 錢包、排行榜或正式排位。
- **WebRTC 選用實驗功能**：玩家雙方主動同意後，使用 `rtc_signal` 協商 DataChannel，傳送簡短 ping/pong 測試 RTT。**不傳輸遊戲操作／勝負／付款資料**，遊戲仍以 WebSocket 伺服器為準；部分網路需要 TURN，目前尚未配置，因此 P2P 不保證連通。RTC 直連可能讓對端看到部分網路連線資訊，故預設關閉。

## 部署
需要啟用 Cloudflare Workers + Durable Objects（*不是* R2，別把存檔桶當作遊戲伺服器）。

```sh
cd realtime
npm install
npm run check
npm run test
npx wrangler login
npm run deploy
```

Worker 部署成功後，先用其實際 `workers.dev` HTTPS URL 做測試，確認同個房間中兩個真實瀏覽器可以同步對局；再視需要設定 Cloudflare 自訂網域 `realtime.snowrealm.pet`，並在遊戲的 `dist/games/spinrealm/config.mjs` 設定公開 `realtimeUrl`。**切勿先寫入假網址**，否則入口會從「未部署」變成失敗連線。不可在 GitHub 放 API 金鑰。遊戲網站 `https://games.snowrealm.pet` 已列入目前 Worker 的 allowed origins。

瀏覽器預設在 `realtimeUrl` 為空時**不會假裝已連線**，好友房會顯示尚未部署的狀態。

## API
- `POST /api/rooms`（帶可信 Origin）→ `{code,wsUrl}`
- `GET /api/rooms/{code}/connect` WebSocket Upgrade
- WS `{type:"hello",name,reconnect?}` → `welcome`, `lobby`
- WS `{type:"start"}`（房主、至少 2 人在線）→ `started`, `state`
- WS `{type:"input",seq,action}`（白名單 left/right/soft/hard/cw/ccw/hold）→ 下一次 `state` 包含 `ackSeq`
- WS `{type:"rtc_ready",enabled:true|false}` 明確告知個人是否同意 RTC，雙方都同意後才准轉發訊號
- WS `{type:"rtc_signal",to,payload}`（僅雙方同意的房內玩家轉發 offer/answer/candidate）
- WS `{type:"ping"}` → `pong`

## 發行前必修
- 身分中心短效 JWT／權限、邀請碼防暴力猜測、限制創建房間的用量、WAF、封鎖與檢舉。
- 斷線續局（目前只有同 DO 執行期重連；重新部署時房間不保證存續）。
- 壓測與每 50ms 模擬步進精準度驗證、慢網路、重送、混亂網路事件。
- TURN/STUN 與 WebRTC 真實 P2P 功能驗收：目前除了訊號轉發，也有**雙方選用的 DataChannel RTT 測試**；沒有 TURN，且沒有透過 RTC 發送可信遊戲狀態。
- 接 Neon 比賽持久化／賽後回放（如需）及審計，不要用客戶端分數結算。
- Cloudflare Workers / Durable Objects 可能有用量、儲存與 WebSocket 帳單，部署前確認方案；房間清理、長期 WebSocket 成本與濫用監控。

**正式 1v1 排位仍走現有 Neon Function + HTTP authoritative-polling beta；本好友房與排位不共用結算。**
