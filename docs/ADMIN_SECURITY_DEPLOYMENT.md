# SnowRealm Games 管理控制台安全部署規格

更新：2026-11-21

## 2026-11-21 Owner 修訂：後台僅屬 Games

本後台不屬於整個 SnowRealm。**正式入口採 Games 網域上的獨立受保護路徑，否決 `admin.snowrealm.pet`**；部署前才將 `RANDOM_GAMES_CONSOLE_PATH` 透過受控配置設為實際值，相關配置不要公開當作秘密安全保障。

## 已採取的止血措施

- 已把 `dist/admin/index.html`、`dist/admin/admin.css`、`dist/admin/admin.mjs` 自公開站點部署輸出移除。
- 原型暫存 `internal/admin-console/`，**不允許被靜態站點當作網站根目錄**。原型中的相對路徑需在遷到獨立管理站時調整。
- 原 `https://games.snowrealm.pet/admin/` 應視為**退役入口**，切勿再作為管理員登入位置。
- `/v1/admin/*` 在程式層須先通過簽章 JWT 驗證，再匹配 `SNOWREALM_ADMIN_SUBJECTS` 明確白名單；白名單預設空，未設即拒絕。後台 V1 僅只讀。
- 靜態移除不保證 Vercel／CDN／瀏覽器已有的舊版本立即消失，必須完成部署、清 CDN 快取並實測舊 URL 回傳 404/403，不再回傳舊 HTML。

## 正式上線的分層設計（尚未部署）

1. **Games 專用入口，獨立部署**：Owner 已否決 `admin.snowrealm.pet`，本後台並非 SnowRealm 全業務管理中心。使用 `https://games.snowrealm.pet/<RANDOM_GAMES_CONSOLE_PATH>/` 作為同一 Games 網域下的路徑入口；管理程式仍需與公開 `dist/` 隔離，採受保護的獨立部署和受控反向代理／rewrite。不得直接把 `internal/admin-console/` 拷貝進公開靜態站。隨機路徑不屬於認證、權限或保密憑證，不在首頁、sitemap 或 PWA precache 提供入口。
2. **路徑級入口存取控制**：在 `games.snowrealm.pet` 上，Cloudflare Zero Trust Access 精確保護候選路徑本身與其所有子路徑（包含 HTML、JS、CSS、API 代理及靜態素材），要求核准管理員身分與 MFA，預設拒絕。不能只鎖首頁而讓 `/admin.mjs` 等資源繞過。**受保護 origin 不得可由公開 Vercel 預覽網址／上游 URL 直接繞過 Access**，必要時驗證 Access JWT 或使用私人網路／origin protection。
3. **後端雙重授權**：管理端呼叫受伺服器簽章 JWT／明確管理員 allowlist／RBAC 保護的 Games API，逐個請求判權；Access 放行只代表通過入口驗證，**不能取代 API 授權**。精確控制 CORS、Origin、管理員 Session 與 Access JWT。沒有額外授權不得接觸 SnowRealm Pet、Shopping、Music、Drama 或其他非 Games 系統。
4. **Games 管理身分政策**：`SNOWREALM_ADMIN_SUBJECTS` 僅儲存在受控環境，不出現在客戶端；Owner/Operator/Support/Auditor 分角色，寫入操作需重新驗證、理由、稽核日誌、二人覆核。
5. **Games 正式路徑與公開舊路徑隔離**：退役 `/admin/` 及舊 `/admin/admin.*` 配置 404／403，並驗證 CDN 舊快取不再返回介面。新隨機路徑只能經 Access 與授權閘門存取，不得加入公開搜尋、靜態部署檔、PWA 預快取或公開導覽。不要把 `robots.txt`、`noindex`、長亂數路徑當作安全措施。
6. **跨遊戲整合**：BRICKDUEL（cube2）只透過服務對服務、限定遊戲命名空間的短效驗證與 API；不共用管理員密碼、不直接開放 `sr_*` 資料表給 Claude 專案。
7. **帳務安全**：金幣、停權、獎勵、退款、會員資料刪除等高風險動作正式實作前需二次授權、細粒度 RBAC、不可竄改稽核、操作回滾策略。

## 驗收清單

- [ ] 退役 `/admin/` 在正式站回 404/403（包含舊 HTML／JS／CSS 與 CDN 快取）。
- [ ] 未登入、未通過 MFA 或非白名單使用者無法取得 Games 候選路徑下的 HTML、CSS、JS，且直接 origin/preview URL 也無法繞過。
- [ ] 已登入非管理員對所有管理 API 請求取得 403。
- [ ] 管理員需 MFA 與 Access 驗證，然後才能用獨立後端授權讀資料。
- [ ] 撤銷存取後新 Session 無法進站，舊 Session 按策略失效。
- [ ] 監測登入失敗、存取異常、Cloudflare Access 稽核及後端授權拒絕。
- [ ] 管理前端經獨立部署及 Games 路徑代理；Vercel／CDN 不會把 `internal/admin-console` 放進公開玩家資產或 PWA precache。
- [ ] 維持 games.snowrealm.pet 公開遊戲頁可正常使用，只有 Games 管理路徑經 Access MFA；完整驗證資產、快取、重導及深層路由。
- [ ] `admin.snowrealm.pet` 未建立此後台的 DNS／專案／路由，不以該網域宣稱 Games 管理站已部署。

**完成以上驗收前不要向一般使用者提供後台 URL，也不要將後台視為已安全上線。**

## 獨立 Cloudflare Worker 發行

使用 Node 24 執行 `npm --prefix server/api ci` 及 `node internal/admin-console/build.mjs`。
`internal/admin-console/wrangler.toml` 只發佈建置輸出。Worker 在 Assets 前執行，且關閉 workers.dev 及預覽網址。正式 route 由 Owner 選定並存入 `ADMIN_ENTRY_PATH`，公開玩家站輸出不含後台。

部署前先在 Zero Trust 建立只涵蓋 Games 管理入口及其所有子路徑的 Access application。Allow 政策只包含核准管理員並要求 MFA。將驗證過的團隊 issuer 和 app audience 分別配置為 `ACCESS_ISSUER` 和 `ACCESS_AUDIENCE`。不得加入 Bypass。沿用 Games 現有的 Neon Auth Origin，並沿用 server 的 Neon JWT 與 `SNOWREALM_ADMIN_SUBJECTS`。Worker 只轉送五個同源 GET 管理路徑至既有 API。

回滾時移除管理 Worker 的路徑綁定，保留 Access 對管理入口及子路徑的封鎖。任何版本不得直接發布 build/assets。

在 Cloudflare Workers Routes 只配置 `games.snowrealm.pet/<RANDOM_GAMES_CONSOLE_PATH>/*`，與 Worker 的 `ADMIN_ENTRY_PATH`（含起迄斜線）對應。Cloudflare DNS 必須為 proxied，原 Games origin 保持原位。Access application 同時覆蓋入口及子路徑。完成正向與負向驗收前，不建立 wildcard 主站 route、公開部署別名或其他直接入口。
