# SnowRealm Games / cube1 開發日誌

這份文件由 GPT 維護；Claude 的 `cube2` 請自行維護其 [docs/DEVLOG.md](https://github.com/luffysky/cube2/blob/main/docs/DEVLOG.md)。

**正式制度**：[Owner 決策與強制開發紀錄規範](./SNOWREALM_GAMES_DEVELOPMENT_GOVERNANCE_AND_CHANGELOG_zh-TW.md)。

## 2026-11-20｜Arcade《零界閃避》原創單人 MVP（開發分支）
- **Owner 決策**：D-003 六款原創遊戲全部開發；Issue #3。
- **實際內容**：新增 `dist/games/zero-dodge/` 三個檔案（可玩頁、純邏輯引擎、Canvas 操作），支援 60 秒計時、隨時間增加彈幕、三命碰撞、受傷無敵時間、勝負、重開、暫停、鍵盤與指標拖曳、背景暫停、本機最佳分數。
- **平台整合**：`dist/index.html` 新增可玩遊戲卡與實際計數；`dist/app.mjs` 收藏支援 Zero Dodge；`dist/sw.js` 加入安全白名單快取；`tests/arcade/zero-dodge.test.mjs` 新增純引擎測試；CI 增加 Arcade 測試。
- **程式與玩家資料**：只新增遊戲頁與本機記錄；無正式資料庫新增／更新／刪除，無變動 cube2。
- **提交**：分支 `feat/arcade-zero-dodge-mvp-20261120`，PR 內查看所有 commits 與 CI。
- **測試與部署**：已新增自動化測試並交 GitHub Actions 驗證；尚未做手機真人操作驗收或正式部署，不宣稱 Steam/雲端排行已開通。
- **待辦**：另外五款仍在 Issue #3，依不同機制逐項做 MVP，不以換皮完成計數。正式玩家錢包與跨裝置進度另需 Identity 服務。

## 2026-11-20｜建立開發紀錄制度

- **執行者**：GPT（cube1）
- **Owner 指令**：D-008，「但做了哪些更改你們自己留log 把我說的都寫進md」。
- **目的**：讓使用者日後能追查 GPT 和 Claude 分別更改了哪些功能、資料庫結構、部署設定及是否真的通過測試。
- **實際新增文件**：
  - `docs/SNOWREALM_GAMES_DEVELOPMENT_GOVERNANCE_AND_CHANGELOG_zh-TW.md`：按時序整理 Owner 的明確決策、兩邊授權、禁刪限制、日誌範本與紀錄義務。
  - `docs/DEVLOG.md`：從本次開始，cube1 後續每次實際改動都在這裡追加。
  - 更新 `docs/BRICKDUEL_ACCOUNT_INTEGRATION_APPROVAL_zh-TW.md`：新增 Claude 自行留 Log 的要求，修正舊版仍寫需 Owner 審批普通新增／更新的矛盾。
- **程式與資料庫**：本次只新增 Markdown 文件，沒有遊戲功能、資料庫結構或玩家資料的變更，也沒有進行刪除。
- **部署**：未由本次工作部署任何程式或資料庫。
- **GitHub 提交紀錄**：Owner 規範 `31ec854b`；本檔建立 `63d50f71`；整合核准書同步修訂 `3b3eb44c`（補 Log 義務與非刪除授權用詞）。
- **驗證**：GitHub 已回報以上文件提交，尚無實機遊戲驗收；本次為文件工作，沒有宣稱測試已通過。
- **追蹤**：Claude 專案的既有日誌由 Claude 自己更新；GPT 未修改 cube2。
- **下一步**：各自後續提交需記原因、檔案/API/DB、commit、測試、正式/預覽部署、未完成事項。以前的提交歷史可逐步補記，但未經核實不可捏造。

## 2026-11-20｜管理後台七日營運報表與 API 測試上線前準備

- **專案／執行者**：GPT／cube1。
- **對應 Owner 指令**：GitHub Issue #2，「你繼續做管理後台」，以及 D-007 非刪除操作授權、D-008 強制留 Log。
- **原因**：原有管理原型僅有總覽、玩家、錢包、對局列表，缺少真正的趨勢與可稽核的數據分析；過往網頁 CI 只跑遊戲測試，沒有執行後端權限測試。
- **實際新增／修改**：
  - `server/api/admin.mjs` 新增 `GET /v1/admin/trends`：固定近 7 個 UTC 日期，伺服器查詢玩家新增、排位對局、帳本正負金幣異動；無資料日補零，來源僅 `cube1`，API 仍經簽章 JWT、管理員白名單與限流，非 GET 回 405。
  - `internal/admin-console/index.html` 增加「營運趨勢」頁、四張彙總數據卡、每日新增／排位柱狀圖與金幣明細表。
  - `internal/admin-console/admin.mjs` 使用純 DOM textContent 繪圖、格式化日期與 BigInt 金幣加總，避免把 API 輸入當 HTML 插入。
  - `internal/admin-console/admin.css` 增加響應式趨勢圖與降低動態效果設定。
  - `tests/api/admin.test.mjs` 增加驗證未授權 403、唯讀 GET、寫入 405、UTC 日期補零、來源查詢不碰帳密欄位。
  - `.github/workflows/pages.yml` 補上 API 測試依賴安裝、`npm run test:api` 與管理 UI JS 語法檢查；不會將內部管理 HTML 複製到公開靜態網站。
  - `docs/SNOWREALM_GAMES_ADMIN_API_BRICKDUEL_HANDOFF.md` 更新查詢欄位契約。
- **資料庫**：僅讀取既有 `sr_profiles`、`sr_ranked_matches`、`sr_wallet_ledger`；**無資料庫 Schema 修改、無 Migration、無玩家資料寫入、無刪除**。
- **提交證據**：API `0af1d064`；管理頁 `2b980e43`；瀏覽器渲染 `577f97d3`；CSS `6306f504`；API 測試 `da229ae3`；CI 強化 `d2485d59`；API 文件 `6835f28a`。
- **CI 驗證**：`d2485d59` 的 GitHub Actions [Web tests](https://github.com/luffysky/cube1/actions/runs/44715102827) 已完成且 success，這輪才開始實際跑 `npm run test:api`。其他提交以各次 Actions 為準。
- **部署狀態**：此輪**未獨立部署正式管理站**、也**未驗證正式 API 新版本已發佈**。正式站仍需 Cloudflare Access／MFA、獨立資產打包、允許來源與已授權管理員的端到端驗收。不得把本機/CI 綠燈說成已經能登入正式後台。
- **安全與未完成**：`cube2` 只透過未來的 server-to-server 機器 JWT 介面接入，尚無真實資料；不會把未接通寫成 0。管理前端目前有跨站登入/靜態資產打包問題，需於獨立部署前修正並驗收。管理操作目前仍限只讀，避免在缺 MFA／稽核時開放玩家資產寫入。
- **回滾**：此輪純程式與文件修改，必要時可由 GitHub 回復對應提交；無資料搬遷需回滾。

## 2026-11-20｜SnowRealm Identity 帳號綁定上線前置核查

- **Owner 指令**：「等你把開關打開」，要求完成 SnowRealm Games 與《轉磚》正式登入綁定。
- **查核**：`cube2/server/identity.js` 已有 Ed25519 JWT 驗證，`cube2/server/app.js` 已有 `idStatus/idLink/idRecover`；`cube1/server/api/auth.mjs` 仍僅實作 Neon Auth API 身分驗證，尚非正式跨站 Identity/OIDC 服務。
- **新增文件**：`docs/SNOWREALM_IDENTITY_LAUNCH_GATE_zh-TW.md`（commit `94dbd92e`），逐項列出正式 issuer/JWKS、平台 UUID 映射、PKCE／BFF、撤銷、資料所有權、跨裝置測試與安全啟用條件。
- **追蹤**：[GitHub Issue #4](https://github.com/luffysky/cube1/issues/4) 記錄 P0 阻塞項。
- **程式／資料庫**：本次未更改正式登入程式，沒有執行 Migration、寫入玩家資料或任何刪除。
- **部署狀態**：SnowRealm Identity 尚未核實正式可用，`IDENTITY_LINK_ENABLED` 維持關閉；不能宣稱帳號已互通。
- **測試**：已比對原始碼與對接文件；**無正式跨站整合測試成功證據**。
- **下一步**：在 `cube1` 開發並部署可驗證的統一身分服務，取得授權網域與安全金鑰部署、進行兩帳號綁定驗收，最後讓 `cube2` 設定正式旗標。未完成前不冒險開關。

## 2026-11-20｜平台 UUID 程式與《轉磚》刪除/回跳決策

- **Owner 指令**：「快點開」，以及「玩家按刪除那刻保留30天 30天後刪除 然後用snowrealm網址沒錯」。
- **程式新增**：`server/migrations/003_platform_identity.sql`（新 `sr_platform_identities`、平台 UUID 唯一映射、RLS；未直接執行正式 Migration）、`server/api/platform-identity.mjs`（既有 Neon Auth subject 綁固定 SnowRealm UUID，並發/重試不重複建立）、`server/api/app.mjs`（需已驗證 Neon JWT 的 `GET /v1/identity/me` 與 `POST /v1/identity/register`；回應明確 `readyForBrickduel:false`）、`server/api/index.mjs`（映射服務 DI）、`tests/api/platform-identity.test.mjs`（認證、唯一性/競態、禁假登入）。
- **程式提交**：`9362e211`、`cbc8238c`、`83d5ab2c`、`02fa2605`、`f359ddcd`。
- **CI**：[GitHub Web tests 44730234056](https://github.com/luffysky/cube1/actions/runs/44730234056) completed / success，含 API 測試；這**不等於正式登入部署成功**。
- **Owner 新決策文件**：`docs/BRICKDUEL_ACCOUNT_LINK_AND_DELETION_POLICY_zh-TW.md`（`effca495`）確認 `https://brickduel.snowrealm.pet` 與 30 天可復原刪除機制；`docs/SNOWREALM_GAMES_DEVELOPMENT_GOVERNANCE_AND_CHANGELOG_zh-TW.md`（`93176137`）新增 D-010、D-011。
- **資料庫及刪除**：本輪未執行正式 SQL Migration，未讀寫或刪除真實玩家資料；Owner 已**特別核准**「玩家本人經驗證申請 + 30 天期滿」的 `cube2` 資料與綁定刪除，實際執行須等 Claude 按規格完成保留期/恢復/到期清理後才啟用。
- **部署／阻塞**：正式 `identity.snowrealm.pet` 授權碼/PKCE/BFF、簽章與 JWKS、撤銷服務及雙玩家端到端驗收**仍未完成**，`cube2` 的綁定開關不得直接開啟；既有 `cube1` Neon Function 尚未確認部署了此次 API 新版。
- **跨專案交接**：Claude 需修改現有「按刪除即刪除」流程為 30 天待刪狀態，正式回跳改 SnowRealm 子網域（具體 callback path 需 BFF 雙方確認），並自行更新 `cube2/docs/DEVLOG.md`。本輪沒有修改 cube2。

## 後續紀錄格式

```markdown
## YYYY-MM-DD HH:mm（Asia/Taipei）｜標題
- 專案／執行者：
- 對應 Owner 決策或 Issue：
- 原因：
- 實際新增／修改／更新：
- 變動檔案、API、資料庫及 Migration：
- 刪除：無／事前核准證據
- Commit / PR：
- 測試與驗收：
- 部署與實際 URL：
- 風險與復原方式：
- 尚未完成：
```
