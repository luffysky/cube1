# SnowRealm Games × BRICKDUEL《轉磚》平台帳號整合開發核准書

**日期：2026-11-20**  
**狀態：核准開發與測試；不代表正式跨站登入已上線。**  
**授權來源：專案 Owner 在本次對話中核准 Claude 將《轉磚》接入 SnowRealm Games；2026-11-20 另明確擴權 GPT 和 Claude 自主新增、編輯、更新（含資料庫），刪除仍需 Owner 核准。**  
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

## 2. Owner 最新授權：非刪除操作可自行開發與更新（2026-11-20）

**此節取代舊版「正式資料庫所有新增／更新均須逐次核准」的限制。**

- **最終所有權與最高治理權**仍歸 Owner。GPT（`cube1`）與 Claude（`cube2`）均獲授權，在各自負責的專案內**自行新增、編輯、更新**程式、文件、資料模型、Schema、Table、Index、Migration、API、配置以及正常業務資料，包含必要的正式環境非刪除性變更，**不必事前逐次向 Owner 請示**。
- 已授權的正常 CRUD 中：`CREATE`、`INSERT`、`UPDATE`、非破壞性 `ALTER` 可依實際任務執行；需維持最小權限、遷移測試、備份或可回滾程序與審計紀錄，避免覆蓋其他協作者的變更。
- **唯一明確保留的事前核准事項：刪除。** 未經 Owner 明確允許，不可執行 `DELETE`、`DROP`、`TRUNCATE`、移除資料表／欄位／索引／資源／repo、清空備份、批次銷毀帳號或刪除使用者資料。
- **不可規避刪除限制**：即使語法是 `UPDATE` 或 `ALTER`，只要會不可逆清空、抹除、覆蓋既有存檔／玩家資產、丟棄歷史資料、破壞原有可用功能或導致事實上的資料刪除，必須先徵得 Owner 核准。
- GPT／Claude 的授權只涵蓋**自己分工內的專案及其必要資源**；不代表兩者可互改對方的 repo、任意讀取其他遊戲玩家資料或取得帳戶/資料庫超級管理員憑證。跨專案資料互通須採受控 API。
- **金鑰保護維持不變**：不得把資料庫密碼、連線字串、服務私鑰、Session Cookie、有效 JWT 等寫入 GitHub、聊天室或公開日誌。依最小權限使用已連接的憑證或由 Owner 在安全管理介面設定。
- **付費方案、高風險帳戶權限擴大、對外公開機密及不可逆操作**不因本次一般新增／更新授權而自動放行；須另外確認。
- **正式上線驗收不等於授權收回**：可自主進行必要更新，但跨站 Identity、金流、帳號綁定等仍須完成安全與端到端測試，不能在尚未提供身分服務時宣稱已可登入。
- 如遇資料庫限制、目前無法執行的操作或需要另外授權的環境，須如實回報；此文件**不會自動授予帳號技術權限**。

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

**階段 B，擴權後可自行執行的範圍：**
- 經測試及保留資料安全的非刪除型資料庫 Migration、正常新增/更新及必要正式功能部署，無須再逐次核准；涉及既有玩家進度與資產仍須驗證合法歸屬、不覆蓋既有存檔。
- Identity issuer/JWKS/授權服務、BFF、callback／CORS／Cookie 等可在有真實受信任服務與安全驗收後整合及更新，不得偽造完成狀態。
- 任何刪除、變相清空/覆蓋、付費方案、高風險權限擴大或敏感資料外洩風險仍須先經 Owner 確認。

**正式啟用驗收：**
1. 兩個不同 SnowRealm 測試帳號可分別登入，不會讀到對方存檔。
2. 同帳號可在兩台裝置找回同份 `cube2` 進度；不會與 `cube1` 金幣混用。
3. 舊裝置憑證、衝突綁定、重試/雙擊、兩台競態、過期/錯 issuer/audience/簽章/JWKS 故障均得到安全處理。
4. 切斷 Identity 或取消授權時，訪客模式不受破壞；敏感寫入拒絕。
5. CI 通過之外有實際測試記錄、Commit SHA、Migration 審核單和部署 URL；沒有這些證據不得宣稱正式可用。

## 8. Claude 交付給 Owner 的內容

- `BRICKDUEL_IDENTITY_ADAPTER_SPEC.md` 更新版與具體修改清單。
- 完整的登入／註冊導引 UI、BFF/Auth Adapter、JWT 驗證與綁定端點（正式關閉）、錯誤／衝突／離線處理。
- **單獨文件**：DDL Migration、回滾方案、資料保全與備份檢查、最小資料庫權限申請。非刪除性變更可按最新授權執行，清楚標註「已執行／未執行」及實際驗收證據；刪除類仍需 Owner 核准。
- 測試案例、CI URL、commit SHA；所有正式資源和資料庫變更需另列核准請求。

## 核准總結

> **正式核准 Claude 開發《轉磚》與 SnowRealm Games 的註冊、登入、帳號綁定、存檔找回及平台整合能力。**  
> **Owner 保留所有資料庫的最高治理權；GPT 與 Claude 獲准在各自分工內自行新增、編輯、更新正式資料庫與程式，無須逐次請示。任何刪除或變相抹除／不可逆覆蓋既有資料，仍須 Owner 事前核准。**  
> **SnowRealm Identity 未完成正式部署及安全驗收前不得對外宣稱已能綁定；完成可靠的正式端到端驗收後可依本次非刪除性更新授權啟用。**

參考來源：
- [cube1 玩家 Identity 交接](./BRICKDUEL_PLAYER_IDENTITY_HANDOFF.md)
- [cube1 管理 API 對接](./SNOWREALM_GAMES_ADMIN_API_BRICKDUEL_HANDOFF.md)
- [cube2 身分適配器規格](https://github.com/luffysky/cube2/blob/main/docs/BRICKDUEL_IDENTITY_ADAPTER_SPEC.md)
- [cube2 管理 API 規格](https://github.com/luffysky/cube2/blob/main/docs/BRICKDUEL_ADMIN_API_ADAPTER_SPEC.md)
