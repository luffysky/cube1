# SnowRealm Games｜共用管理後台 API 與 Claude《轉磚》對接規格
版本 v0.2（2026-11-20）。本文確認 cube1 與 cube2 的唯讀介面契約。正式管理站、機器憑證與跨遊戲查詢仍待部署驗收。

## 1. 分工與邊界

- GPT / cube1：SnowRealm Games 後台網站、平台管理身分驗證、`/v1/admin/*`、未來 Identity 整合。
- Claude / cube2：BRICKDUEL 獨立遊戲資料庫、管理摘要 API、事件發布器與配對／統計安全性。
- 兩邊共用的只有 SnowRealm Identity 平台 `player_id`（未部署前的過渡鍵須明確標明）；《旋界》與《轉磚》的金幣、段位、獎勵、道具與對局**完全獨立**。
- Claude **不要**直接修改 `cube1`、SnowRealm 主資料庫、`sr_*` 資料表或 GitHub Secrets。

## 2. 現在已提交的管理後台

- 控制台原型存放在 `internal/admin-console/`。公開站 `/admin/` 已退役。正式管理站須依[管理部署規格](ADMIN_SECURITY_DEPLOYMENT.md)完成獨立部署、入口驗證與 MFA。
- API 程式：`server/api/admin.mjs`，由 `server/api/app.mjs` 驗 JWT 並查 `SNOWREALM_ADMIN_SUBJECTS` 明確白名單。
- 管理員以個人登入身分通過驗證，伺服器只授權列在 `SNOWREALM_ADMIN_SUBJECTS` 的個人 `sub`。空白名單拒絕所有人。
- 後台只讀，沒有「加金幣」「改段位」「停權」「看玩家密碼」「刪帳號」之類動作。
- 後台資料不做 PWA 離線快取，HTTP 請求 `cache: no-store`，只以 `Authorization: Bearer JWT` 請求伺服器，絕不使用 localStorage 存放 JWT。

## 3. 目前管理 API（僅 cube1）

程式已隨 cube1 會員 API 部署至 Neon Function 第 4 版。正式 `/health/ready` 回 200，未帶憑證讀 `/v1/admin/overview` 回 401。獨立管理站尚未部署，已授權管理員讀取資料的端到端驗收仍待完成。對接 cube2 的機器簽發及呼叫端另見第 5 節。

| Method | Path | 現行授權 | 回應 | 狀態 |
|---|---|---|---|---|
| GET | `/v1/admin/overview` | 個人 JWT＋管理員白名單 | `{service,scope,readOnly,players,wallets,outstandingCoins,rankedMatches,runningMatches,queuedPlayers,settlements,fetchedAt}` | 已部署，管理員權限待驗收 |
| GET | `/v1/admin/players` | 個人 JWT＋管理員白名單 | `{scope,limit,items:[{playerId,nickname,friendCode,createdAt,coins,rating,games}]}` | 同上 |
| GET | `/v1/admin/ledger` | 個人 JWT＋管理員白名單 | `{scope,limit,items:[{eventId,playerId,delta,balanceAfter,reason,createdAt}]}` | 同上 |
| GET | `/v1/admin/matches` | 個人 JWT＋管理員白名單 | `{scope,limit,items:[{matchId,players,status,startedAt,settledAt}]}` | 同上 |

規則：
- 管理端必須用有效、簽章驗證的 Neon Auth EdDSA JWT，且 `sub` 出現在伺服器環境變數 `SNOWREALM_ADMIN_SUBJECTS`；未授權回 HTTP 403。
- 缺少管理模組回 503；未部署路由回 404；未登入 JWT 回 401；寫入方式回 405。
- 列表固定最多 50 筆，本版頁面只看前 25 筆。不得從公開頁面直接枚舉所有玩家或取得 Email、密碼與 Session。
- 將來 `admin:write` 必須另外具備二次授權、分級權限、審計、回滾和操作原因。不應直接在 v0.1 開放。

## 4. BRICKDUEL 唯讀資料契約

以下路徑皆以 `/internal/admin/v1/` 開頭。cube1 接受 cube2 規格 §3.1–3.6 的資料語意。cube2 `5137358` 已有 `zz.matches`、`zz.ledger`，尚無對外管理 handler。兩者須分別驗收。[cube2 對接規格](https://github.com/luffysky/cube2/blob/5137358f93f750931a4017a869361557a0d6cc71/docs/BRICKDUEL_ADMIN_API_ADAPTER_SPEC.md)

| GET 路徑 | 回應與計數單位 |
|---|---|
| `overview` | `gameId` 固定 `brickduel`、`apiVersion` 固定字串 `1`。`players`、`playersActive7d`、`bannedPlayers`、`playerGamesTotal`、`openRooms`、`quickQueue`、`boxesOpened7d` 是非負整數。`coinsOutstanding` 是十進位整數字串，`generatedAt` 是 UTC 時間戳。`playerGamesTotal` 來自各玩家生涯場數加總，`openRooms` 計未過期房間，`quickQueue` 計快速配對中等待的房間。|
| `players` | `{items, nextCursor}`。每筆有 `gameUserId`、`snowrealmPlayerId`、`publicTag`、`nickname`、`level`、`coins`、`rating`、`season`、`rankedGames`、`games`、`banned`、`createdAt`、`lastSeenAt`。Identity 完成綁定前 `snowrealmPlayerId` 回 `null`。|
| `draws` | §3.4 的分頁開箱紀錄 `drawId`、`gameUserId`、`at`、`boxes`，以及期間內按等級的 `summary`。|
| `matches` | §3.5 的分頁對局紀錄，以 `matchLogId` 唯一識別一位玩家的一場紀錄。連線遊戲多人共用房間，每個座位分別計數。`result` 為玩家回報，`proven` 表示落點核對是否通過。|

分頁 `limit` 預設 25，可取 1–100。客戶端原樣傳回不透明的 `cursor`，讀到 `nextCursor: null` 即結束。金幣欄位使用十進位整數字串。時間戳採 UTC ISO 8601，日報用 `YYYY-MM-DD`。未啟用或無法量測的統計回 `null`，能量測且筆數為零時回 `0`。畫面須區分這兩種情形。

### 4.1 `metrics`

| 欄位 | 型別與定義 |
|---|---|
| `players.total`、`players.guest`、`players.linked`、`players.banned` | 玩家計數。`total` 僅含雲端存檔，`guest` 是未綁平台帳號者。Identity 未開通時所有存檔均為 guest；依 §3.6，已知從未有綁定可回 `linked: 0`，尚無綁定資料來源可回 `null`。|
| `players.steam`、`players.minorDeclared`、`regions` | Steam 上線前 `steam` 回 `null`。有核准且可用的自選資料才回未成年計數、按地區代碼分組的計數，否則相應欄位回 `null`。|
| `devices.total`、`devices.perPlayer`、`devices.unsaved` | 已綁定雲端存檔的裝置數、每名雲端玩家的平均裝置數、無雲端存檔的裝置數。零位玩家時平均值回 `null`。未統計匿名啟動時 `unsaved` 回 `null`。|
| `subs.active`、`subs.trial`、`subs.paid` | 有效、體驗、付費會員計數。|
| `active.d1`、`active.d7`、`active.d30` | 分別在最近 1、7、30 天曾上線的玩家人數。|
| `economy.coinsOutstanding`、`economy.itemsOutstanding` | 金幣餘額加總（字串）、各道具的持有數量。|
| `matches.today`、`boxes.today` | UTC 當日的玩家對局列數（按模式）、已開寶箱數（按等級）。|
| `online.openRooms`、`online.quickQueue` | 未過期連線房間數、快速配對等待房間數。|

### 4.2 `metrics/daily?from=YYYY-MM-DD&to=YYYY-MM-DD`

每個 UTC 日一列，含首尾兩日，依 `date` 升冪整理。兩端採以下欄位。

| 欄位 | 定義 |
|---|---|
| `date`、`newPlayers`、`activePlayers` | UTC 日期、新建雲端存檔人數、當日有對局紀錄的不重複玩家數。|
| `matches`、`rankedGames`、`onlineMatches` | 按模式分類的玩家對局列數，以及排位、連線的玩家對局列數。|
| `boxesOpened`、`coinsEarned`、`coinsSpent` | 按等級的開箱數，以及從 `zz.ledger` 算出的金幣獲得與支出金額（正向金額，十進位整數字串）。|
| `newSubs` | 當日新訂閱數。無法從歷史資料可靠重建時回 `null`。|
| `steamNewPlayers`、`steamActivePlayers` | 原 §3.6 的 `steam*` 為欄位類別。cube1 為 v1 指定這兩個鍵，分別預留 Steam 新增、活躍玩家數，現階段均回 `null`。|

### 4.3 `players/{gameUserId}`

路徑參數為 cube2 `gameUserId`（UUID）。§3.6 原先只列內容；cube1 指定 v1 的 JSON 欄位如下，供兩端實作。

- 沿用玩家列表的所有欄位與型別，包括顯示用 `publicTag`、`nickname`、`rating`、`coins`、`banned`、`createdAt` 和 `lastSeenAt`。
- 加入 `items`（依遊戲道具 ID 的持有量）、`subscription`（`active` 布林、`kind` 為 `trial`／`paid`／`null`、`until` 為 UTC 時間戳或 `null`）、`deviceCount`（非負整數）。
- `recentMatches` 與 `recentDraws` 沿用上述列表的單筆結構，各按時間由新至舊取最多 50 筆。零筆回 `[]`，查無該 UUID 回 404。
- 回應排除密鑰雜湊、引繼碼、IP、原始 `state` 與 `srv`。cube2 仍負責存檔與平台帳號的綁定關係。

## 5. 管理 API 的機器身分

SnowRealm 平台 Identity 的**機器簽發端**負責簽發。cube1 的 Neon Function 管理 API 是發出查詢的服務。它先驗個別管理員，再以獨立服務帳號透過 HTTPS 呼叫 cube2。瀏覽器只持有自己的登入身分。架構沒有承諾固定出口 IP；來源網域、Origin 或 IP 不能授予此權限。

| 參數 | 正式設定契約（待部署） |
|---|---|
| `BRICKDUEL_ADMIN_ISSUER` / JWT `iss` | `https://identity.snowrealm.pet` |
| `BRICKDUEL_ADMIN_JWKS_URL` | `https://identity.snowrealm.pet/.well-known/admin-jwks.json`，僅發布管理機器金鑰的公開部分。玩家用 JWKS 另行管理。|
| JWT `aud` | `snowrealm:brickduel:admin` |
| JWT `scope` | `brickduel:admin:read`，按空白分隔後檢查完整 scope。|
| `BRICKDUEL_ADMIN_SUBJECTS` / JWT `sub` | `svc:snowrealm-games-admin`，這裡只放管理 API 的服務帳號。個人管理員 `sub` 由 cube1 的 `SNOWREALM_ADMIN_SUBJECTS` 另行授權。|
| JOSE / 時間 | `alg=EdDSA`、`kid` 必填，可信 JWKS 裡同 `kid` 的唯一一把 `OKP`／`Ed25519` 驗簽公鑰。`iat`、`nbf`、`exp` 為整數 Unix 秒；`iat` 與 `nbf` 不得晚於驗證時間，`exp` 必須在有效期內（容許 60 秒時鐘差）。簽發 300 秒，驗證 `0 < exp - iat ≤ 600`。|
| 稽核 | `jti` 為每次簽發的唯一識別值。同一短效 token 的唯讀重試與分頁可重複使用；每次查詢都記錄。cube1 在受控稽核紀錄關聯個人管理員與 `jti`，cube2 記錄 `at/sub/jti/path/status`，保留 180 天。兩端均避免記錄完整 token。|

**輪替。** 簽發端為下一把鑰匙產生從未用過的 `kid`，先在同一份 JWKS 並列新舊公鑰。至少過 10 分鐘的驗證端快取期後才切換新 `kid` 簽發。從最後一次使用舊鑰簽署算起，至少再保留舊公鑰 11 分鐘（最長效期加時鐘容差）。驗證端只信任設定的 HTTPS JWKS，快取上限 10 分鐘，未知 `kid` 最多做一次有頻率限制的重新抓取；有效快取過期且更新失敗時拒絕驗證。

**緊急撤銷。** 撤銷某位管理員時，cube1 移除個人授權並終止其管理 session。撤銷機器帳號時，cube2 移除服務 `sub` 並重載所有實例。若簽署私鑰外洩，停用該 `kid` 簽發、從 JWKS 移除並清除所有驗證端快取；未確認快取已清的期間先把機器 `sub` 從白名單移除。使用內嵌 `BRICKDUEL_ADMIN_JWKS` 的實例須直接更新設定。待新鑰完成核對後再開通。`jti` 稽核本身沒有撤銷效果。

**環境與錯誤。** 正式信任關係須等機器簽發端、公開 JWKS 及 cube2 管理路由可用再啟用。未設定回 503。無憑證、簽章或身分聲明驗證失敗回 401；缺 scope 或服務帳號不在名單回 403。cube2 採每個 `sub` 每分鐘 60 次，GET 以外回 405，成功與錯誤都回 `Cache-Control: no-store`。任何一端故障時，後台顯示來源不可用，不能用 0 筆取代。

**離線驗簽。** [測試 fixture](../tests/api/fixtures/brickduel-admin-jwt.json) 提供 Ed25519 公開 JWK、完整簽名 JWT、獨立的 `.invalid` 測試 issuer、服務帳號與驗證時鐘。私鑰僅在產生測試向量時存在於記憶體。fixture 已過期，專供本機測試。先以 `npm ci --prefix server/api` 安裝後端依賴，再於 repo 根目錄執行 `node --test tests/api/brickduel-admin-contract.test.mjs`。正式環境須使用正式信任設定。

## 6. 驗收與交接

1. cube1 部署獨立管理站及個人 MFA，驗證一般帳號與已撤銷帳號無法讀資料。兩邊分別驗證機器用與玩家用 audience 隔離。
2. Claude 在 cube2 實作唯讀 handler、欄位、分頁與稽核；cube1 實作受權管理查詢，設定逾時、回應上限和故障隔離。現有 cube1 原型只查 cube1 自有資料。
3. 用非正式環境測有效／過期 token、錯 `iss`／`aud`／`sub`／`scope`、重複 `jti` 的唯讀分頁、換鑰與撤銷；待身份與回應契約實測後再開通正式憑證。
