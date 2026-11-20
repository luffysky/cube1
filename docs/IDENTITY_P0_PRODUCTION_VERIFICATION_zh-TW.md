# SnowRealm Identity P0｜2026-11-21 驗收紀錄

基準：cube1 main `b290fd9afec8c50880ceb4cb7e7f882f763646fc`。cube2 唯讀基準 `7cf274b94528c5a1b88ea10d2fd39a6b59b73a4d`。

| Gate | 實際結果 |
|---|---|
| 003／004 | 在指定 Neon production 的 `cube1` 唯讀確認五張表、平台 UUID 唯一約束、授權碼 client/state 唯一索引、有效期索引和外鍵。五表有 RLS，未強制套用於表 owner。表 ACL 只列 `cube1_owner`，PUBLIC 無直接權限，現有 RLS policy 為空。 |
| 快照／還原 | 手動快照 `snap-curly-resonance-b3xxwfup` 確認來自 production。還原到獨立分支 `br-gentle-shape-b39xjkts`，首次讀取有 003、無 004。只在演練分支重跑 004 後，兩分支均有 004，profiles=1、wallets=1、wallet ledger=2、identities=0。這是筆數核對，本次正式庫只執行 SELECT。 |
| 最小角色 | `identity/neon/sql/runtime-role.sql` 在本機 Postgres/PGlite 驗證，以角色身分建立 UUID、寫入並一次性消耗授權碼、讀取撤銷狀態。拒絕刪除授權碼、寫入撤銷及讀取錢包。正式角色尚未配發。 |
| Neon 部署 | Production Function 清單只有 `cube1api` 部署 4（Node 24）。沒有 Identity Function 部署 ID；自訂網域清單為空。 |
| 正式 HTTPS | Cloud Browser 開啟 `https://identity.snowrealm.pet/health/live` 回報 `ERR_HTTP2_PROTOCOL_ERROR`。尚無可核對的正式 HTTP 狀態碼、JWKS、TLS 或 readiness。 |
| Secrets | 未驗證正式 Identity 環境的 `IDENTITY_ED25519_PRIVATE_PEM`、`IDENTITY_ACTIVE_KID`、`IDENTITY_BRICKDUEL_CLIENT_SECRET`、`IDENTITY_DATABASE_URL`、`NEON_AUTH_BASE_URL`、`NEON_AUTH_JWKS_URL`。 |
| BFF／E2E | cube2 callback 只有規格。cube1 現行授權 API 接受瀏覽器表單的 consent 布林值，nonce 雜湊已儲存但交換端未核對。仍需可信後端同意與交易綁定、BFF Session、限流和稽核。兩組帳號均未開始正式環境測試。 |

既有 CI：[PR #7](https://github.com/luffysky/cube1/actions/runs/44770816454)、
[PR #9](https://github.com/luffysky/cube1/actions/runs/44779170413)、
[PR #10](https://github.com/luffysky/cube1/actions/runs/44780007060)、
[PR #11](https://github.com/luffysky/cube1/actions/runs/44780625206)、
[PR #12](https://github.com/luffysky/cube1/actions/runs/44781233957)。

## 正式角色與恢復

正式權限核准後，配發獨立登入並授予 `sr_identity_runtime` 成員資格，避免 owner、BYPASSRLS 與遊戲角色。用該登入核對繼承權限、指定 production 的連線、RLS policy 實際作用及各遊戲表無存取權，再配置 `IDENTITY_DATABASE_URL`。演練分支保留作稽核，禁止 finalize。若 Identity 部署需回復，先停用入口及綁定，再回復服務版本／DNS，撤回專用登入的角色權限。勿使用這份遷移前快照覆蓋玩家資料。

## Brickduel 整合契約（待上線驗收）

| 項目 | 契約 |
|---|---|
| Identity | Issuer `https://identity.snowrealm.pet`，JWKS `/.well-known/jwks.json`。 |
| 授權 | 現行 Adapter 為 `POST /oauth/authorize`，由 Games 提供經驗證的 Neon 登入。輸入 `clientId`、`redirectUri`、`codeChallenge`、`state`、`nonce`。正式同意與登入意圖接口仍待完成。 |
| Client | `brickduel-bff`，精確 callback `https://brickduel.snowrealm.pet/api/auth/callback`。 |
| BFF 交易 | 伺服器產生 S256 verifier、state、nonce，短效綁定瀏覽器工作階段與明確同意。Callback 固定檢查 issuer、state、nonce、時效、會話及一次性使用。現行 token 回應尚無 nonce 證據，正式雙方介面需補齊後驗收。 |
| Token | BFF 執行 `POST /oauth/token`，伺服端標頭 `x-snowrealm-client-secret`。JSON 欄位 `clientId`、`redirectUri`、`code`、`codeVerifier`。Code 最長 90 秒，token 最長 300 秒。 |
| JWT | Ed25519，`aud=snowrealm:brickduel:api`、`scope=brickduel:account:link`。驗證 `iss`、`aud`、`scope`、`sub`（平台 UUID）、`iat`、`nbf`、`exp`、`jti`、`kid`。 |
| 即時撤銷 | `POST /v1/token/status` 使用 Bearer token。只有有效且明確為 active 才受理。其餘錯誤、逾時、停權或未知金鑰皆拒絕。Brickduel 在交易內防止 `jti` 重放。 |
| Session／存檔 | 伺服器端保存 Session，cookie 使用 Secure／HttpOnly。Token 不出現在 URL。不同存檔回 409，保留原存檔。換裝置需重新登入並以同平台 UUID 讀回已連結進度。 |
| 環境變數 | cube2 既有 `IDENTITY_ISSUER`、`IDENTITY_JWKS_URL`、`IDENTITY_AUDIENCE`、`IDENTITY_LINK_ENABLED`。BFF 新增的機器憑證建議沿用 `IDENTITY_BRICKDUEL_CLIENT_SECRET`，由兩部署端的秘密管理機制配置。開關維持 OFF 直到正式雙帳號驗收。 |
