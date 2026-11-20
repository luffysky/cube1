# SnowRealm Games × BRICKDUEL《轉磚》平台帳號整合開發核准書

**日期：2026-11-20**  
**狀態：核准開發與測試；不代表正式跨站登入已上線。**  
**授權來源：專案 Owner 在本次對話中要求核准 Claude 將《轉磚》接入 SnowRealm Games，並明確指定「所有資料庫都由 Owner 管理」。**  
**執行：Claude，僅限 `luffysky/cube2`；平台側由 GPT 維護 `luffysky/cube1`。**

## 1. 核准範圍

核准 Claude 開發《轉磚》與 SnowRealm Games 的整合功能，包括：

1. 將《轉磚》列入 SnowRealm Games 遊戲館，保留獨立遊戲部署與原有訪客試玩。
2. 開發「註冊／登入 SnowRealm Games」入口與返回原遊戲的導覽流程，準確標示目前已可用和未啟用的能力。
3. 以 SnowRealm Identity 作為未來跨遊戲的單一平台身分來源；設計 OAuth/OIDC 授權碼 + PKCE S256、精確註冊的 redirect URI、一次性 state、防 CSRF，使用受控伺服器 BFF 保存工作階段。不得在瀏覽器暴露長期 token 或服務密鑰。
4. 建立《轉磚》匿名存檔與平台 `snowrealmPlayerId` 的一對一綁定程式、Migration 草案、交易邏輯、衝突處理、取消流程、驗證器與測試；正式啟用依第 3、7 節。
5. 登入後提供跨裝置取回同一份已綁定《轉磚》進度的介面，並保留現有未登入訪客玩法。
6. 五語 UI、錯誤畫面、離線/重連提示、未成年與地區適用規則，以及隱私權告知。註冊、存檔綁定和廣告同意不可混為一個勾選。
7. 適配 SnowRealm Games 平台導航、會員入口及未來綜合平台 App，不能以此取得其他遊戲資料庫權限。

本文件**允許實作程式及測試**，不代表已存在可用的 SnowRealm Identity 正式授權伺服器。若正式服務尚未部署，`IDENTITY_LINK_ENABLED` 必須預設關閉；不得用假 JWT、模擬資料或舊 Neon Auth token 冒充跨站登入已成功。

## 2. Owner 資料庫最高權限：強制規定

**SnowRealm 所有資料庫、正式資料與資料庫權限由 Owner 本人統一管理。**

- Owner 為最終核准者：資料庫建立或刪除、Schema／Table／Index／RLS／Trigger 變更、Migration 執行、正式資料搬遷與合併、備份還原、資料保留、資料庫角色與憑證、跨服務存取政策。
- Claude 與 GPT 可以**撰寫** SQL、資料模型、Repository 程式、Migration 草案及測試，並提出必要的執行清單，但**沒有自動執行正式資料庫變更的授權**。
- **禁止** Claude 或 GPT 未經 Owner 個別明確核准，直接在正式 Neon / Postgres 執行 DDL、DML 批次異動、刪除、更名、重設、搬遷或權限調整；禁止新增或取得資料庫超級使用者權限。
- **禁止**共享、複製、輸出或在聊天、程式庫、CI 日誌、PR 夾帶連線字串、DB 密碼、服務簽章私鑰、Session Cookie、Steam Ticket 或有效 JWT。
- 即使既有自動建表程式已存在，也不得把**新 Schema 變更**經由部署時自動執行；新 Migration 須經 Owner 審核與明確授權後，才按核准的方式執行。
- 如需測試資料庫，應使用與正式環境隔離的測試專案或資料庫及最小必要權限；如涉及任何由 Owner 管理的帳號、資源或費用，先取得核准。
- Claude 只能修改 `cube2` 的程式碼、文件、測試與核准的開發配置；**不得改動 `cube1`、平台 Identity 服務、其他遊戲資料庫或 GitHub Secrets**。

## 3. 身分架構與正式契約

參照 `cube1/docs/BRICKDUEL_PLAYER_IDENTITY_HANDOFF.md`：

| 項目 | 預定契約 |
| --- | --- |
| 平台玩家唯一 ID | SnowRealm Identity 簽發 JWT `sub`（UUID），不等於 Neon Auth sub、SteamID、轉磚本機 ID |
| issuer | `https://identity.snowrealm.pet`，正式服務部署後須驗證 |
| JWKS | `https://identity.snowrealm.pet/.well-known/jwks.json`，目前不可假設已可用 |
| player audience | `snowrealm:brickduel:api` |
| 綁定 scope | `brickduel:account:link` |
| 管理 audience | `snowrealm:brickduel:admin`，與玩家授權嚴格隔離 |
| JWT | EdDSA/Ed25519、受控 `kid`、`iat`／`exp`／`jti`；壽命 ≤ 600 秒，時鐘容差最多 60 秒 |
| 綁定方式 | 適當重驗身分 + 原裝置憑證驗證 + 唯一性交易；競態與衝突應返回明確錯誤 |

**本機資料庫型別注意：** `cube2/server/db.js` 現行 `zz.players.id` 是 **UUID**。既有 `cube2/docs/BRICKDUEL_IDENTITY_ADAPTER_SPEC.md` 草案寫 `pid bigint` 與現況矛盾；Claude **必須先修正 Migration 草案為 UUID 外鍵**，不得直接執行錯誤草案。

建議的**僅供審核**模型：`zz.identity(platform_id uuid PRIMARY KEY, pid uuid UNIQUE REFERENCES zz.players(id), linked_at timestamptz NOT NULL, provider_hint text)`。確切表名、欄位、索引、RLS、保留期由 Owner 核准；此例不是執行指令。

## 4. 已有匿名玩家與綁定保護

- `cube2` 目前匿名存檔為遊戲自有 `zz.players.id`，不得為了接平台要求現有玩家強制刪檔或歸零。
- 綁定前兩側必須證明控制權；UUID 的存在本身不等於控制權。
- 對端平台 ID 已綁其他轉磚存檔、或本地存檔已綁其他平台帳號時：回 409，**不自動合併或覆蓋**，展示清楚的選項並保留兩套資料。
- 交易成功後輪替舊裝置憑證、失效一次性轉移碼，後端重新核對所有權及撤銷狀態；不得僅靠前端顯示已登入就認可資產操作。
- 不把《轉磚》的金幣、道具、段位、排行榜或經濟直接併入《旋界》；遊戲經濟由各遊戲可信伺服器隔離維護。
- 目前可提供登入導覽，**不應顯示「已綁定」或「雲端互通成功」**，直到雙方正式端到端驗收。

## 5. 註冊／登入前端與跨站流程

1. 《轉磚》提供清楚的「SnowRealm Games 登入／註冊」入口，連至目前**真實可用**的平台登入入口；沒有直達註冊路由時，引導玩家使用平台登入按鈕，不編造 `?member=register` 已生效。
2. 入口完成後由平台核准的授權服務回到**事先登記**的 `cube2` BFF callback。不可自行拼接任意跳轉網址，不允許 open redirect。
3. BFF 將平台短效授權轉成《轉磚》可用的伺服器工作階段；不得把 Refresh Token 放入 localStorage，嚴格設置 Cookie 安全屬性（使用時考慮 SameSite、Secure、HttpOnly、CSRF）。
4. 若玩家未登入平台、Identity 暫不可用，原有本機遊玩與匿名存檔仍正常；只封鎖需平台身分的綁定操作。
5. 新帳號登入後的個人資料、暱稱與地區/年齡欄位以最小化資料及玩家明確告知為原則；不以地區語言或 IP 推斷居住地。

## 6. 與管理後台分離

`cube2/docs/BRICKDUEL_ADMIN_API_ADAPTER_SPEC.md` 的管理機器 JWT（`snowrealm:brickduel:admin` / `brickduel:admin:read`）**不能**兼用玩家登入；管理 API 只能由授權的服務對服務調用，不能公開給瀏覽器。

管理後台、CRM、ERP、玩家綁定、錢包等跨服務資料存取各自受 RBAC、最小權限與可稽核的操作控管；未獲 Owner 核准，不得新增管理寫入能力。

## 7. 分階段放行

**階段 A，現在核准：**
- 文件／協定／UI／Auth Adapter、BFF、JWT 驗證器、匿名資料關聯程式、SQL Migration **草案**及所有離線測試；
- PR／提交 `cube2` 程式，但相關 feature flag 預設為 OFF；
- 可執行不觸碰正式資料庫的單元測試、整合模擬及本地測試。

**階段 B，須 Owner 再核准：**
- 正式資料庫 Migration、資料匯入或既有匿名進度綁定的**真實寫入**；
- 正式 Identity issuer/JWKS/授權伺服器、BFF 憑證、callback / CORS / cookie 策略與上線環境設定；
- 有真實玩家資料的端到端測試、上線開關以及付費／廣告／管理權限調整。

**正式啟用驗收：**
1. 兩個不同 SnowRealm 測試帳號可分別登入，不會讀到對方存檔。
2. 同帳號可在兩台裝置找回同份 `cube2` 進度；不會與 `cube1` 金幣混用。
3. 舊裝置憑證、衝突綁定、重試/雙擊、兩台競態、過期/錯 issuer/audience/簽章/JWKS 故障均得到安全處理。
4. 切斷 Identity 或取消授權時，訪客模式不受破壞；敏感寫入拒絕。
5. CI 通過之外有實際測試記錄、Commit SHA、Migration 審核單和部署 URL；沒有這些證據不得宣稱正式可用。

## 8. Claude 交付給 Owner 的內容

- `BRICKDUEL_IDENTITY_ADAPTER_SPEC.md` 更新版與具體修改清單。
- 完整的登入／註冊導引 UI、BFF/Auth Adapter、JWT 驗證與綁定端點（正式關閉）、錯誤／衝突／離線處理。
- **單獨文件**：DDL Migration 草案、回滾方案、資料保全與備份檢查、最小資料庫權限申請。**標註「待 Owner 核准、未執行」。**
- 測試案例、CI URL、commit SHA；所有正式資源和資料庫變更需另列核准請求。

## 核准總結

> **正式核准 Claude 開發《轉磚》與 SnowRealm Games 的註冊、登入、帳號綁定、存檔找回及平台整合能力。**  
> **不核准 Claude 或 GPT 自行管理或變更任何正式資料庫。所有資料庫由 Owner 親自管理，任何正式資料庫變更須另行取得 Owner 明確批准。**  
> **不核准在 SnowRealm Identity 未完成正式部署與安全驗收前開啟綁定。**

參考來源：
- [cube1 玩家 Identity 交接](./BRICKDUEL_PLAYER_IDENTITY_HANDOFF.md)
- [cube1 管理 API 對接](./SNOWREALM_GAMES_ADMIN_API_BRICKDUEL_HANDOFF.md)
- [cube2 身分適配器規格](https://github.com/luffysky/cube2/blob/main/docs/BRICKDUEL_IDENTITY_ADAPTER_SPEC.md)
- [cube2 管理 API 規格](https://github.com/luffysky/cube2/blob/main/docs/BRICKDUEL_ADMIN_API_ADAPTER_SPEC.md)
