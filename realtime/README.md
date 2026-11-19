# SPINREALM WebSocket 好友房（測試版）

## 能做什麼
- 2–4 名玩家使用同一房間碼，在各自瀏覽器一起玩。
- WebSocket 對戰狀態傳輸；Cloudflare Durable Object 每個房間由唯一實例管理。
- `Game` 方塊、分數、消行和攻擊由伺服器判定，客戶端只送合法操作與遞增序列。
- 對手可見棋盤，客戶端可切換棋盤／數據顯示。
- 用於**休閒好友房**，不加入 Neon 錢包、排行榜或正式排位。
- WebRTC 訊號轉發通道已預留（`rtc_signal`），遊戲勝負仍以 WebSocket 伺服器為準。

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

部署後須將 Worker 設定到獨立的 `realtime.snowrealm.pet`，並在遊戲的 `dist/games/spinrealm/config.mjs` 設定公開 `realtimeUrl`。不可在 GitHub 放 API 金鑰。遊戲網站 `https://games.snowrealm.pet` 已列入目前 Worker 的 allowed origins。

瀏覽器預設在 `realtimeUrl` 為空時**不會假裝已連線**，好友房會顯示尚未部署的狀態。

## API
- `POST /api/rooms`（帶可信 Origin）→ `{code,wsUrl}`
- `GET /api/rooms/{code}/connect` WebSocket Upgrade
- WS `{type:"hello",name,reconnect?}` → `welcome`, `lobby`
- WS `{type:"start"}`（房主、至少 2 人在線）→ `started`, `state`
- WS `{type:"input",seq,action}`（白名單 left/right/soft/hard/cw/ccw/hold）→ 下一次 `state` 包含 `ackSeq`
- WS `{type:"rtc_signal",to,payload}`（僅房內轉發 offer/answer/candidate）
- WS `{type:"ping"}` → `pong`

## 發行前必修
- 身分中心短效 JWT／權限、邀請碼防暴力猜測、限制創建房間的用量、WAF、封鎖與檢舉。
- 斷線續局（目前只有同 DO 執行期重連；重新部署時房間不保證存續）。
- 壓測與每 50ms 模擬步進精準度驗證、慢網路、重送、混亂網路事件。
- TURN/STUN 與 WebRTC 真實 P2P 輔助功能驗收（目前只含訊號轉發，不承諾連線成功）。
- 接 Neon 比賽持久化／賽後回放（如需）及審計，不要用客戶端分數結算。
- 房間清理、長期 WebSocket 成本與濫用監控。

**正式 1v1 排位仍走現有 Neon Function + HTTP authoritative-polling beta；本好友房與排位不共用結算。**
