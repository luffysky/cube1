# SnowRealm Games / cube1 開發日誌

這份文件由 GPT 維護；Claude 的 `cube2` 請自行維護其 [docs/DEVLOG.md](https://github.com/luffysky/cube2/blob/main/docs/DEVLOG.md)。

**正式制度**：[Owner 決策與強制開發紀錄規範](./SNOWREALM_GAMES_DEVELOPMENT_GOVERNANCE_AND_CHANGELOG_zh-TW.md)。

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
