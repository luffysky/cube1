# SnowRealm Games｜共用管理後台 API 與 Claude《轉磚》對接規格
版本：2026-11-20 · v0.1 · **先供審查，不代表已完成 cube2 串接**

## 1. 分工與邊界

- GPT / cube1：SnowRealm Games 後台網站、平台管理身分驗證、`/v1/admin/*`、未來 Identity 整合。
- Claude / cube2：BRICKDUEL 獨立遊戲資料庫、管理摘要 API、事件發布器與配對／統計安全性。
- 兩邊共用的只有 SnowRealm Identity 平台 `player_id`（未部署前的過渡鍵須明確標明）；《旋界》與《轉磚》的金幣、段位、獎勵、道具與對局**完全獨立**。
- Claude **不要**直接修改 `cube1`、SnowRealm 主資料庫、`sr_*` 資料表或 GitHub Secrets。

## 2. 現在已提交的管理後台

- 靜態前端：`/admin/index.html`、`/admin/admin.mjs`、`/admin/admin.css`。
- API 程式：`server/api/admin.mjs`，由 `server/api/app.mjs` 驗 JWT 並查 `SNOWREALM_ADMIN_SUBJECTS` 明確白名單。
- **預設拒絕所有管理帳號**；沒有配置白名單或正式部署後端，後台只有前端頁面，讀不到任何管理資料。
- 後台只讀，沒有「加金幣」「改段位」「停權」「看玩家密碼」「刪帳號」之類動作。
- 後台資料不做 PWA 離線快取，HTTP 請求 `cache: no-store`，只以 `Authorization: Bearer JWT` 請求伺服器，絕不使用 localStorage 存放 JWT。

## 3. 目前管理 API（僅 cube1）

基底目前同 SnowRealm Games Neon Function API（部署前不可視為正式可用）。

| Method | Path | Scope | 回應 | 狀態 |
|---|---|---|---|---|
| GET | `/v1/admin/overview` | admin:read | `{service,scope,readOnly,players,wallets,outstandingCoins,rankedMatches,runningMatches,queuedPlayers,settlements,fetchedAt}` | 已寫入 GitHub，部署待驗收 |
| GET | `/v1/admin/players` | admin:read | `{scope,limit,items:[{playerId,nickname,friendCode,createdAt,coins,rating,games}]}` | 同上 |
| GET | `/v1/admin/ledger` | admin:read | `{scope,limit,items:[{eventId,playerId,delta,balanceAfter,reason,createdAt}]}` | 同上 |
| GET | `/v1/admin/matches` | admin:read | `{scope,limit,items:[{matchId,players,status,startedAt,settledAt}]}` | 同上 |

規則：
- 管理端必須用有效、簽章驗證的 Neon Auth EdDSA JWT，且 `sub` 出現在伺服器環境變數 `SNOWREALM_ADMIN_SUBJECTS`；未授權回 HTTP 403。
- 缺少管理模組回 503；未部署路由回 404；未登入 JWT 回 401；寫入方式回 405。
- 列表固定最多 50 筆，本版頁面只看前 25 筆。不得從公開頁面直接枚舉所有玩家或取得 Email、密碼與 Session。
- 將來 `admin:write` 必須另外具備二次授權、分級權限、審計、回滾和操作原因。不應直接在 v0.1 開放。

## 4. Claude 需準備的《轉磚》管理讀取 API

Claude 請**先審核自己的 cube2 真實資料模型**，再提供以下資料格式（不可虛構數據）：

### 4.1 `GET /internal/admin/v1/overview`（規劃，尚未開通）

```json
{
  "gameId": "brickduel",
  "players": 0,
  "activeMatches": 0,
  "totalMatches": 0,
  "rankedQueue": 0,
  "coinsOutstanding": "0",
  "generatedAt": "2026-11-20T00:00:00Z"
}
```

### 4.2 `GET /internal/admin/v1/players?limit=25&cursor=...`

- 只回傳轉磚遊戲自己的 playerId、對應平台 player_id、暱稱、轉磚金幣／排位及建立時間。
- 不回傳 Neon Auth 密碼、Steam Ticket、原始 JWT、Cookie、客戶端指紋及 Email。
- `player_id` 目前尚未全面切換，過渡期必須明確區分 `neon_sub` 與 `snowrealm_player_id`，不可直接混用。

### 4.3 `GET /internal/admin/v1/matches?limit=25&cursor=...`

- 回傳 ID、參戰人、模式、status、起迄及 server settlement。
- 不直接回傳完整對局盤面或可重播敏感資料；需要觀戰／回放時另建權限化 API。

## 5. Server-to-server 安全協定（建議，尚未部署）

1. 統一 Identity 後端發行短效 JWT，`iss=https://identity.snowrealm.pet`、`aud=snowrealm:admin-ingest`、`sub` 為獨立的機器服務身分，`scope=brickduel:admin:read`（必要時也限制具體端點與來源）。
2. 使用 EdDSA 與 `kid` 進行 JWKS 輪替；強制驗 `exp`、`iat`、`nbf`、`jti`，到期上限 10 分鐘；密鑰只存後端 Secret Store。
3. **管理後台瀏覽器絕不直接打 cube2 私有 API。** 由 SnowRealm API 以固定對外服務來源，代表已授權管理員去 cube2 查只讀摘要。網路須做逾時及錯誤隔離，不因 cube2 故障拖垮 cube1。
4. 每個遊戲獨立 provider/namespace、rate limit、審計、pagination、回應大小上限、去重及資料最小化。
5. 若改採 cube2 推送的事件機制，另設計 `eventId`、版本、簽章及時效、抗重放、每個遊戲專屬的冪等稽核表；不得直接開放公開 `POST /v1/admin`。
6. 未建立 Identity 時，禁止為了趕進度而交出 SnowRealm 管理 JWT 或直接共用個人 API Token。

## 6. Claude 交付格式

請提交 `BRICKDUEL_ADMIN_API_ADAPTER_SPEC.md`，包含：
- cube2 真實現況（已有資料表、API、部署、登入驗證）及每項引用程式檔案；
- 可支援哪些統計／玩家／交易／對局端點，對照此文件欄位型別；
- 身分／存取模型與 Steam-only 玩家如何映射平台 ID；
- 計數、餘額、比賽結算的伺服器權威來源；
- 429、403、401、重試、逾時、取消、追蹤 ID、事件冪等設計；
- 測試：一般玩家 403、偽造 JWT 拒絕、混用 cube1/cube2 audience 拒絕、資料隔離、未部署的安全降級；
- 上線前需 GPT 配合的 API 與 Secrets 列表；**現在先不要碰 cube2 正式環境，等協定及權限對齊。**

## 7. 待完成

- 確認管理員的 Neon Auth user `sub` 並在正式服務設定最小權限 allowlist；需先核對非公開權限授予。
- 部署 `server/api/admin.mjs`，執行管理員與非管理員登入測試。
- 加入管理操作稽核與更細緻 RBAC，將財務／停權動作獨立審核。
- 建立 Claude Adapter 的私有 HTTPS 通道與健康檢查、真實測試，再允許後台顯示 BRICKDUEL 指標。
