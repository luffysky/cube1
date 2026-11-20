# SnowRealm Games 管理控制台安全部署規格

更新：2026-11-20

## 已採取的止血措施

- 已把 `dist/admin/index.html`、`dist/admin/admin.css`、`dist/admin/admin.mjs` 自公開站點部署輸出移除。
- 原型暫存 `internal/admin-console/`，**不允許被靜態站點當作網站根目錄**。原型中的相對路徑需在遷到獨立管理站時調整。
- 原 `https://games.snowrealm.pet/admin/` 應視為**退役入口**，切勿再作為管理員登入位置。
- `/v1/admin/*` 在程式層須先通過簽章 JWT 驗證，再匹配 `SNOWREALM_ADMIN_SUBJECTS` 明確白名單；白名單預設空，未設即拒絕。後台 V1 僅只讀。
- 靜態移除不保證 Vercel／CDN／瀏覽器已有的舊版本立即消失，必須完成部署、清 CDN 快取並實測舊 URL 回傳 404/403，不再回傳舊 HTML。

## 正式上線的分層設計（尚未部署）

1. **獨立網站**：管理介面放在獨立部署專案，不與公開玩家站共用 `dist/`。其實際網域由管理員透過可信管道取得，不在玩家導覽、網站地圖或公開文檔提供。網址不是安全憑證，並非單靠亂數路徑保密。
2. **入口存取控制**：整站置於 Cloudflare Access 或等級相當的前置閘道後，提供已核准管理員的身份驗證與 MFA。未通過驗證者連 HTML、JS、CSS 都不得取得；預設全部拒絕。
3. **內部 API**：管理端呼叫受伺服器簽章 JWT/RBAC 保護的 API，逐個請求判權；不能只因 Cloudflare Access 通過就授與後端權限。分離遊戲 API 與管理 API 時，限制 Origin／audience，必要時驗證 Access JWT。
4. **身分政策**：`SNOWREALM_ADMIN_SUBJECTS` 僅儲存在受控環境，不出現在客戶端；Owner/Operator/Support/Auditor 分角色，寫入操作需重新驗證、理由、稽核日誌、二人覆核。
5. **公開路徑防護**：退役舊路徑配置 404/403，禁止索引、列目錄、網站預快取，並確實確認 CDN 不回傳舊版。不要以 `robots.txt` 或 `noindex` 代替權限。
6. **跨遊戲整合**：BRICKDUEL（cube2）只透過服務對服務、限定遊戲命名空間的短效驗證與 API；不共用管理員密碼、不直接開放 `sr_*` 資料表給 Claude 專案。
7. **帳務安全**：金幣、停權、獎勵、退款、會員資料刪除等高風險動作正式實作前需二次授權、細粒度 RBAC、不可竄改稽核、操作回滾策略。

## 驗收清單

- [ ] 退役 `/admin/` 在正式站回 404/403（包含舊 HTML／JS／CSS 與 CDN 快取）。
- [ ] 未登入、非白名單使用者無法取得獨立管理站的 HTML。
- [ ] 已登入非管理員對所有管理 API 請求取得 403。
- [ ] 管理員需 MFA 與 Access 驗證，然後才能用獨立後端授權讀資料。
- [ ] 撤銷存取後新 Session 無法進站，舊 Session 按策略失效。
- [ ] 監測登入失敗、存取異常、Cloudflare Access 稽核及後端授權拒絕。
- [ ] Vercel 專案根目錄與發行步驟不會把 `internal/admin-console` 當成公開資產。

**完成以上驗收前不要向一般使用者提供後台 URL，也不要將後台視為已安全上線。**

## 獨立 Cloudflare Worker 發行

使用 Node 24 執行 `npm --prefix server/api ci` 及 `node internal/admin-console/build.mjs`。
`internal/admin-console/wrangler.toml` 只發佈建置輸出。Worker 在 Assets 前執行，且關閉 workers.dev 及預覽網址。正式 route 由 Owner 選定並存入 `ADMIN_ENTRY_PATH`，公開玩家站輸出不含後台。

部署前先在 Zero Trust 建立覆蓋整個管理網域的 Access application。Allow 政策只包含核准管理員並要求 MFA。將驗證過的團隊 issuer 和 app audience 分別配置為 `ACCESS_ISSUER` 和 `ACCESS_AUDIENCE`。不得加入 Bypass。確認 Neon Auth 已信任此管理站 Origin，並沿用 server 的 Neon JWT 與 `SNOWREALM_ADMIN_SUBJECTS`。Worker 只轉送五個同源 GET 管理路徑至既有 API。

回滾時移除管理 Worker 網域綁定，保留 Access 對整個主機的封鎖。任何版本不得直接發布 build/assets。
