# SnowRealm Games / cube1 開發日誌

這份文件由 GPT 維護；Claude 的 `cube2` 請自行維護其 [docs/DEVLOG.md](https://github.com/luffysky/cube2/blob/main/docs/DEVLOG.md)。

**正式制度**：[Owner 決策與強制開發紀錄規範](./SNOWREALM_GAMES_DEVELOPMENT_GOVERNANCE_AND_CHANGELOG_zh-TW.md)。

## 2026-11-21｜Claude cube2 唯讀營運 API、OAuth BFF 與必要 Cookie 交付複核
- **cube2 實證**：只讀 `luffysky/cube2` main `853b5e97cc581b819c0bc29c3721a2000638952d`，主要功能 commit `0ff7364e8d862f035d5ad013c3106a711ed9ccc1`，CI [44835328522](https://github.com/luffysky/cube2/actions/runs/44835328522) success。已讀 [cube2 正式回覆](https://github.com/luffysky/cube2/blob/main/docs/CUBE1_REPLY_20261121.md)、`server/admin.js`、`server/bff.js`、`api/auth/*`、`src/consent.js` 與 `legal/src/privacy.zh-Hant.html`。
- **cube2 管理 API**：已在原始碼實作 7 支 `/internal/admin/v1/*` 唯讀路由及 EdDSA/JWKS 身分驗證、稽核與分頁；Claude 回報 Vercel READY，但當前管理信任未設定，正式 `overview` 與 `metrics/daily` 回 503 `disabled`。本輪無已驗證的有效機器 JWT 正式 200/401/403 E2E，不能當已串通。
- **cube2 OAuth BFF**：`POST /api/auth/start`、`GET /api/auth/callback`、`POST /api/auth/result` 已存在；測試回報 `test/bff.test.js` 66 件及前端 9 件通過，具有 PKCE S256／一次性 session、HttpOnly/Secure/Lax 必要 Cookie 與 409 存檔隔離。正式 Identity 尚缺可信同意和授權端，故沒有真實跨裝置 E2E。
- **隱私文案**：已核對繁中／英／日／韓四語 `src/consent.js` 說明了一個必要的 `__Host-zzauth` Cookie；繁中隱私政策第 4 節列出設定時機、內容、用途與 10 分鐘期限。技術文案完成不等於所有司法轄區的法律審查完成。
- **cube1 必補契約**：目前 `identity/oauth-core.mjs` 的 `exchange()` 簽發時未傳 `nonce`、`identity/authority.mjs` 的 `issuePlayerToken` 不支援 `nonce` claim；正式對接前應保留授權碼資料庫只存 `nonceHash`，在 code 交換通過原子雜湊核對後，將已驗證的 nonce 傳給 Signer 寫入短效 JWT，令 cube2 BFF 驗證**必填且完全相等**，並補測試。BFF 目前只在 token 存在 nonce 時才比對，應由 Claude 跟進必填契約。Admin 機器簽發需獨立 `admin-jwks.json` 和機器身分、不得拿玩家 JWT 取代。
- **追蹤**：主待辦新增 SRG-142～144，僅勾選 cube2 源碼/CI/文案階段，總數 56/144；原 SRG-128、SRG-131、SRG-093 仍未完成正式多端驗收，Identity/後台不開放未驗收的操作。源碼直接讀取之外的公開 HTTP 端點經網頁工具嘗試未取得可靠驗收證據。
- **剩餘待 Owner 決策**：`zz.admin_log` 180 天保留後清除，以及 `zz.authsess` 過期暫存清理屬於資料刪除政策，先提受控清理及復原方案，不擅自執行批次 DELETE；R2 實際上傳保持待人工測試。
- **安全邊界**：本輪未修改 cube2、Neon production、Secrets、Cloudflare/Vercel、玩家資料；只更新 cube1 文件與跨專案交辦。

## 2026-11-21｜SnowRealm Games 管理後台正式 60 頁規格交付
- **Owner 決定**：本後台只屬於 SnowRealm Games，固定 GA-01～GA-60 共 60 個主功能頁、8 大模組，不屬於 SnowRealm 全業務後台。
- **新文件**：`docs/SNOWREALM_GAMES_ADMIN_60_PAGES_SPEC_zh-TW.md`，每頁列功能、資料來源、Route、驗收重點。收錄 60 條未完成頁面核取項，分成首版 19 頁、營運擴充 26 頁、進階 15 頁。
- **現況辨識**：7 個僅有界面原型，不代表正式完整頁面；正式管理路徑、Cloudflare Access/MFA、全部管理 API、cube2 統計對接仍須部署及驗收。
- **網址／資安**：遵守 Owner D-012，不使用 `admin.snowrealm.pet`；正式候選入口為 `games.snowrealm.pet/<RANDOM_GAMES_CONSOLE_PATH>/`，前端與玩家公開站隔離，需 MFA／RBAC／origin 防旁路。
- **主待辦更新**：只新增並勾選 SRG-141「正式 60 頁規格交付」，總數 53/141；60 頁 UI 完工仍在新規格清單中全部保持未完成，避免將規格等同部署。
- **實際操作**：本次僅 cube1 文件 commit，不改 cube2、Neon 資料、Secret、遊戲資產、Identity 綁定或正式後台路由。

## 2026-11-21｜cube1/Work 與 cube2/Claude 雙線開發交辦
- **Owner 方向**：不得因 Identity 尚未部署而停止 cube2 API 或 BFF 的安全開發；兩條線同步推進。不能擅自停用既有功能，也不能在雙方正式驗收前擅自切換跨遊戲綁定。
- **現場核對**：Cube1 main `62bbd15e030b706dc3f0b47748e682299cf1b36a`，cube2 main `5324f3a1431dc4b4de34a45cc0026eb999cc7a21`。Cube2 管理 API 規格已存在，最新 tree 查無實作的 `/internal/admin/v1/*` handler，也未見正式 OAuth callback/token exchange handler。
- **Claude 接辦範圍**：只在 cube2 實作唯讀營運 API（overview/players/draws/matches/metrics/metrics-daily/player detail）及 `brickduel.snowrealm.pet/api/auth/callback` BFF 狀態機；要求短效機器 JWT、精確受眾與 scope、PKCE/session、409 不覆蓋、匿名模式及原有 30 天刪除政策。僅程式或測試通過不能視為正式啟用。
- **Work 接辦範圍**：只在 cube1 做 Games 專屬受 MFA 保護的管理後台、伺服器對伺服器 cube2 Adapter；繼續以既有最小權限部署 identity Function、可信使用者同意、正式 TLS/JWKS/撤銷驗證，最後雙帳號 E2E。
- **交接證據**：已在 [cube1 Issue #2](https://github.com/luffysky/cube1/issues/2#issuecomment-7052509965) 與 [Issue #4](https://github.com/luffysky/cube1/issues/4#issuecomment-7052510626) 寫入詳細執行交接；另提供本次 ChatGPT 對話中的兩份 Markdown 交辦附件。這是交接文件，**不是已直接在 Claude 或 Work 建立新執行工作階段**。
- **權限與現況**：本輪沒有修改 cube2、正式 DB、Player 資產、部署機密或 `IDENTITY_LINK_ENABLED`。總待辦沿用 52/140，尚未將 API/BFF/Identity 正式驗收標記完成。

## 2026-11-21｜Owner D-012 修正 Games 專屬後台網址與權限範圍
- **Owner 新指令**：「這只是 games 的 admin，不是整個 SnowRealm；admin.snowrealm.pet 不給過」。此決策取代此前在聊天中建議的 `admin.snowrealm.pet` 方案，與 Identity P0 不混用。
- **路由正式方案**：Games 管理後台入口應在 `games.snowrealm.pet/<RANDOM_GAMES_CONSOLE_PATH>/`，使用受保護的獨立管理部署與同網域路徑代理。舊 `/admin/` 保持退役。隨機路徑不等於安全控制。
- **安全與權限**：Cloudflare Access 在路徑與全部靜態資產要求 MFA，並限制直接 origin URL 繞過；後端 `/v1/admin/*` 繼續驗簽 JWT + `SNOWREALM_ADMIN_SUBJECTS`，不開放其他 SnowRealm 業務與金幣寫入。正式 route、DNS、MFA、HTTP 及雙授權仍待實測。
- **實際變更**：`docs/ADMIN_SECURITY_DEPLOYMENT.md`、`docs/SNOWREALM_GAMES_DEVELOPMENT_GOVERNANCE_AND_CHANGELOG_zh-TW.md` 增加 D-012、`docs/SNOWREALM_GAMES_ADMIN_API_BRICKDUEL_HANDOFF.md` 更新 Games 範圍、`internal/admin-console/index.html` 修正控制台標示，並更新本檔與主待辦。
- **總待辦**：新增 SRG-140，只勾選「新路由與權限邊界已決策」，總計 52/140；正式後台部署/Access/MFA/API/E2E（SRG-089 至 094）維持未完成。
- **證據與部署**：此輪文件與現有 HTML 文案的 GitHub commit 可由 main history 核對；沒有部署任何正式管理站、沒有新增 DNS、沒有動 cube2 或正式 DB，也沒有變更 Identity 綁定旗標。

## 2026-11-21｜PR #15 正式 DB 目標與撤銷 API 安全修補已合併
- **使用者交付／核對**：Work 提交 [PR #15](https://github.com/luffysky/cube1/pull/15)，提交 `795e327d76457cffdce4786c2ce0c8d08e08448a`，已審查實際 patch 和 [PR CI #44815136421](https://github.com/luffysky/cube1/actions/runs/44815136421) success；合併至 main `b64abb9c2c2a5fbc4b4772cba6811ac09491711c`，[main CI #44815611765](https://github.com/luffysky/cube1/actions/runs/44815611765) success。
- **獨立 Neon 核對**：production `raspy-king-43847627` / `br-winter-thunder-b3ozovl2` 的 compute 主機 `ep-crimson-truth-b3j5tyvk.c-4.ap-southeast-1.aws.neon.tech` 與 PR 的 allowlist 相符；該 compute pooler_enabled=false，正式服務應採直接連線、不得假稱 pooler 已開啟。
- **實際修改**：`identity/neon/index.mjs` 限定 Neon DB host、database=`cube1`、user=`sr_identity_service`、TLS 憑證 `rejectUnauthorized=true`，且使用獨立 DB 角色確認 session/current user；`identity/neon/trusted-app.mjs` 的 `/v1/token/status` 增加 BFF client-secret 檢查、禁止 Origin、回應只含 `{active}`；`/oauth/authorize`、`/oauth/token` 仍為 503。
- **正式環境限制**：Neon Function 查核仍只有 `cube1api` active deployment 4，custom domains 空；沒有 `identity` deployment ID。`IDENTITY_DATABASE_URL`、Ed25519 private key 和 BFF secret 仍未安全注入部署，不能把網域 503 當成 Identity 的正式回應。
- **紀錄與進度**：本次只合併 fail-closed 防護，不代表安全登入上線。總待辦維持 51/139，Issue #4 保持 OPEN；不更動 `cube2` 或 `IDENTITY_LINK_ENABLED`。
- **下一輪**：Work 以安全憑證管道注入正式 Function Secrets，Node24 使用已合併 main 打包並部署獨立 `identity`；優先核對 Neon 原生 Function URL、HTTP/JWKS/DB readiness，然後配置 DNS/TLS；可信同意與 BFF 安全鏈接仍未完成。

## 2026-11-21｜PR #14 Identity HTTP 授權安全閘門合併與正式部署查核
- **交接來源**：Work 完成 PR #14，修正客戶端 `consent:true` 可直接觸發授權的安全漏洞；使用者回報後，本對話以 GitHub 實際差異與 Neon 正式部署清單獨立核對。
- **程式**：[PR #14](https://github.com/luffysky/cube1/pull/14) 已 squash 合併至 main，commit `db8aba8215a0dde1c9757b6ae09aa7360ea9d824`。Identity HTTP `/oauth/authorize`、`/oauth/token` 在缺乏受信任伺服器端同意時統一回應 503；`/health/ready` 即使 DB ready 也回 503 並單獨提供 `databaseReady`；既有 OAuth core、撤銷及離線驗證仍保留。
- **測試**：PR GitHub Actions [44812843133](https://github.com/luffysky/cube1/actions/runs/44812843133) success；合併後 main CI [44813437598](https://github.com/luffysky/cube1/actions/runs/44813437598) success。新增測試確保客戶端 `consent:true`、具有 Authorization header 的呼叫和任意 BFF Secret 均無法繞過 503。
- **正式服務獨立查核**：Neon 正式 `raspy-king-43847627` / `br-winter-thunder-b3ozovl2` 的 Functions 清單仍僅 `cube1api` active deployment 4；沒有 Identity Function deployment，也無已註冊的 Function custom domain。未從這個查核推定 `identity.snowrealm.pet` 503 的伺服器來源。
- **未完成／風險**：`IDENTITY_DATABASE_URL`、Ed25519 私鑰、BFF Client Secret 的正式安全部署、可信同意與 BFF Session、Identity HTTPS/JWKS/撤銷實測、cube2 callback、雙帳號 E2E 均未完成。`IDENTITY_LINK_ENABLED` 保持 OFF；本輪未修改正式 DB、cube2、DNS、Secret 或玩家資產。
- **總待辦**：延續 51/139；此 PR 是既有 SRG-042～046 的安全閘門修補，不把「禁止授權」記成「授權服務完成」。

## 2026-11-21｜Work PR #13 合併與正式 Neon 專用登入驗收
- **原始交接**：Work 回報 PR #13 已合併，正式 `sr_identity_service` 使用真實登入執行 RLS 驗收；使用者已將回報直接帶回本對話。
- **GitHub 獨立核實**：[PR #13](https://github.com/luffysky/cube1/pull/13) merged=`true`，merge commit `d546b8245a16bdff94f53b4f7970ea99977c65fa`；[main CI #44792842791](https://github.com/luffysky/cube1/actions/runs/44792842791) completed/success。Work 驗收紀錄：[Issue #4 comment 7049561777](https://github.com/luffysky/cube1/issues/4#issuecomment-7049561777)。
- **正式 Neon 親自查核**：Neon Cube1 專案 `raspy-king-43847627`、production `br-winter-thunder-b3ozovl2`、DB `cube1`。使用專用 `sr_identity_service` 角色執行唯讀 SQL，`session_user`、`current_user` 均為 `sr_identity_service`，`row_security_active('public.sr_platform_identities')` 與 `row_security_active('public.sr_identity_authorization_codes')` 均為 true；該登入密碼已存在、BYPASSRLS=false；正式 8 條 RLS Policy 和最小欄位 grants 前次已核對。
- **Work 完成的回滾測試**：Issue #4 記載合成資料的 UUID 建立、授權碼新增和消耗、撤銷狀態讀取成功；存取錢包和刪除授權碼被拒，測試交易回滾。此項以 Work 的 GitHub 操作紀錄為證據，未由本次唯讀查核再次寫入正式資料庫。
- **備份與最小權限**：已有 Snapshot `snap-curly-resonance-b3xxwfup`，PR #13 記載在隔離分支復原演練。總待辦 SRG-040 依可驗證條件完成（51/139）；整套系統的完整災難回滾 SRG-116 仍未通過。
- **尚未完成、不得提前打勾**：`IDENTITY_DATABASE_URL` 尚未配置至正式 Identity Function，簽發私鑰/BFF Client Secret、可信同意鏈、Identity 部署與 DNS/TLS/JWKS、cube2 callback、兩個實際帳號跨裝置測試。`IDENTITY_LINK_ENABLED` 仍為 OFF。
- **安全**：本次僅唯讀查核正式資料庫與更新 cube1 Markdown 文件，無正式玩家資料異動、無刪除、無私鑰或資料庫密碼外洩。

## 2026-11-21｜P0 Revoked kid 禁簽與 SnowRealm Games 平台明確同意連結入口
- **修補安全漏洞**：[PR #11](https://github.com/luffysky/cube1/pull/11) (`adb3b2d7`) 已對 OAuth 發行端增加持久化 revoked kid 查詢，撤銷後停發 JWT；PR CI [44780625206](https://github.com/luffysky/cube1/actions/runs/44780625206) success。
- **平台登入橋接**：[PR #12](https://github.com/luffysky/cube1/pull/12) (`4f5944ba`) 已加入 `dist/sso-flow.mjs`、`dist/sso-bridge.mjs`、會員 in-memory Neon JWT accessor、遊戲館互動入口與 PWA 安全快取清單；只接受 C-022 的精確 `https://brickduel.snowrealm.pet/api/auth/callback`，玩家點擊確認後才發出授權請求。
- **測試**：PR CI [44781233984](https://github.com/luffysky/cube1/actions/runs/44781233984) success；拒絕惡意 redirect／弱 PKCE／token URL，原會員 JWT 不寫入 URL、localStorage 或 Log。
- **正式功能限制**：尚無 Identity HTTPS 服務正式部署證據，Neon deploy tool 拒絕了密鑰部署請求；遊戲館介面在 Identity 不可用時只顯示失敗、不修改或合併任何存檔。Claude/cube2 尚未實作真實 callback BFF，正式綁定保持 OFF。
- **勾選**：主總表新增 SRG-139 只記平台橋接程式／CI 已完成。正式 DNS、BFF、2 帳號 E2E、備份還原與最小權限沒有勾選；總數 50/139。

## 2026-11-21｜P0 正式 004 遷移、Snapshot 與可信 Identity 服務核心
- **Owner 指令**：正式 Identity、BFF、004、金鑰／撤銷、雙帳號 E2E 立即優先；僅核實後才開跨遊戲綁定。
- **資料庫**：正式 SnowRealmGames-Cube1／production br-winter-thunder-b3ozovl2（DB cube1）。已先建立 Snapshot `snap-curly-resonance-b3xxwfup`／`pre-identity-004-20261121`，再於單一 transaction 套用 `server/migrations/004_identity_authorization.sql`（11 條不破壞 SQL）。
- **Schema 實測**：新表 sr_identity_authorization_codes、sr_identity_account_status、sr_identity_revoked_jti、sr_identity_revoked_kids 均存在且 RLS=true；PUBLIC SELECT=false；平台映射表 0 筆、原 wallets=1、wallet ledger=2 未動。未執行 DELETE/DROP/TRUNCATE 或玩家資產更新。
- **GitHub**：[PR #9](https://github.com/luffysky/cube1/pull/9) JWKS 公開唯讀 handler / 測試併入 `a7113762`；[PR #10](https://github.com/luffysky/cube1/pull/10) 可信 Neon JWT → PKCE 授權碼／BFF 專用憑證／撤銷狀態 API Adapter 與 Node24 esbuild 併入 `c5fa90a6`；整合 main CI [44780171358](https://github.com/luffysky/cube1/actions/runs/44780171358) success。
- **真實部署狀態**：Neon deploy_function 在上傳公鑰／私鑰環境的工具呼叫遭安全檢查阻擋，未取得 deployment ID 或正式 URL；沒有完成 DNS／TLS、真實 JWKS 可用性，也沒有公開 OAuth 授權端點。未嘗試繞過安全檢查。
- **安全尚缺**：Identity 專用最小權限資料庫角色、可信秘密儲存、BFF HttpOnly 工作階段與真正的 cube2 callback、實際 Snap restore 演練、雙帳號 E2E、限流及監控仍待完成。絕不將這些項目打勾。
- **勾選與分工**：正式總表 v1.3 依可證據新增 3 個子項，合計 49/138；Claude repo 未修改，cube2 IDENTITY_LINK_ENABLED 保持關閉。

## 2026-11-21｜核對 cube2 C-022 正式 OAuth callback 與 30 天刪除工程狀態
- **讀取範圍**：只讀 `luffysky/cube2` 的身份 Adapter 文件、DEVLOG、server/core.js、server/app.js，沒有變更 Claude Repo。
- **正式回呼路徑**：cube2 C-022 定案 `https://brickduel.snowrealm.pet/api/auth/callback`；此前 cube1 OAuth 離線測試以 `/api/auth/callback/snowrealm` 當測試樣例，現在已同步測試使用 C-022 的正確正式 path。此路徑**目前仍沒有完成 BFF Handler**，只是合約定案，不可宣稱已可登入。
- **30 天刪除**：cube2 `core.wipe`、`restore`、`idRecover(back:true)`、`gone` 保留和期滿 `PURGE` 交易的程式已存在；但目前 PURGE 依其他請求順帶觸發，沒有獨立定時器，因此不保證到期準時刪除。SRG-129 與跨裝置驗收保留未完成。
- **文件／勾選**：更新 Identity Gate、兩份測試的 callback 約定與主待辦 SRG-047。完成的只是正式 redirect URI 規格，總表更新為 46/135。
- **權限／部署**：未更動 cube2、正式玩家資料、付費權限或身份綁定旗標；尚無實際 OAuth/BFF 正式部署證據。
- **提交與驗證**：[PR #8](https://github.com/luffysky/cube1/pull/8) 已合併 `55e4b786acce5c7c0f4298c852b1721261266977`，GitHub Actions [44771740342](https://github.com/luffysky/cube1/actions/runs/44771740342) success；規格與測試已同步，正式 callback BFF 尚未實作。

## 2026-11-21｜P0 Identity 正式映射表及一次性 OAuth 核心
- **Owner 指令**：優先 P0，高風險工程採高度推理；對應 Issue #4、SRG-040～049。
- **正式 Neon 實際查核**：SnowRealmGames-Cube1 專案 raspy-king-43847627／production br-winter-thunder-b3ozovl2／cube1。原正式庫缺少 sr_platform_identities；此次執行 003 對應的 CREATE TABLE IF NOT EXISTS、REVOKE ALL FROM PUBLIC、ENABLE ROW LEVEL SECURITY。重新讀取 Schema/SQL：新表 0 筆、唯一 platform_player_id 存在、RLS=true、PUBLIC SELECT=false；既有 wallets=1、ledger_rows=2。沒有更動 cube2 或其他同名 Neon 專案。
- **安全限制**：Neon 沒有列出可用 Snapshot；owner role 仍可 bypass RLS。未聲稱備份、最小權限或正式 OAuth 已完成。
- **GitHub 實作**：identity/oauth-core.mjs（90 秒一次性授權碼、S256、精確 callback 白名單、300 秒玩家 JWT）、identity/oauth-store.mjs（Postgres 原子消耗與停權/jti/kid 狀態）、server/migrations/004_identity_authorization.sql（僅草案，**沒有**執行正式庫）、identity/authority.mjs（status callback 加入簽名 iat）及 tests/identity/oauth-core.test.mjs、tests/api/identity-schema.test.mjs。
- **文件**：docs/IDENTITY_P0_OAUTH_REVOCATION_SECURITY_GATE_zh-TW.md；docs/SNOWREALM_GAMES_MASTER_CHECKLIST_zh-TW.md 將完成的結構與程式核心拆分勾選，總數更新為 45/135。
- **測試**：PR #7 GitHub Actions [44770816454](https://github.com/luffysky/cube1/actions/runs/44770816454) completed/success，包含 Identity JWT/PKCE 單元測試、Postgres/WASM 004 Migration 的原子 code 消耗與撤銷、既有 API/PWA 測試。尚無正式跨站雙帳號登入 E2E，不能視為已上線。
- **GitHub 合併**：[PR #7](https://github.com/luffysky/cube1/pull/7) 已以 squash commit `440595e7feee71784c6a45b763d4b79bea56a83b` 合併到 main。
- **部署及權限**：OAuth API / BFF 未接入、003 表以外不做正式 DB Migration、沒有任何 Secret、Token 或持續登入設定公開；cube2 身分綁定保持 OFF。
- **剩餘風險**：正式 004 Migration／備份與恢復、最小權限、Neon session → BFF、OAuth authorize/token 路由、真實 callback、DNS/TLS、機器驗證的撤銷服務、兩帳號 E2E。

## 2026-11-20｜建立 133 項 SnowRealm Games 全專案總待辦
- **Owner 指令**：「你所有項目列待辦 做好的打勾 全部 每次做完就更新」，並要求依工作難度選擇中／高推理。
- **新增文件**：`docs/SNOWREALM_GAMES_MASTER_CHECKLIST_zh-TW.md`，涵蓋平台/PWA、SPINREALM、六款 Arcade、Identity、52 HUNT、NEXT FLOOR、會員商城／廣告／任務、後台、Steam 桌面發行、原創音效、安全隱私及 Claude cube2 對接依賴。
- **盤點結果**：建立時 133 條；43 條勾選「已找到程式／規格／CI 等該行所寫的證據」，90 條尚未實作、部署或驗收。勾選不等於整套系統可商用，進度不是按工期加權。
- **GitHub 證據**：總表建立 commit `40cd779d7f2d011774308631c902f703ff10ec60`；已驗證最新一次 Web CI success（#44766914423）。
- **工作流程**：從現在起每次實際開發提交，連同本表勾選、`docs/DEVLOG.md`、相關 Issue 一起更新。無法或未進行的真機、線上驗收不能擅自勾選；新的 Owner 決策只能追加並保留歷史。
- **權限與安全**：只修改 GPT 專案 `cube1` 的文件，沒有碰 Claude 的 `cube2`、正式 DB、Secret、玩家資產或付費機制；未刪除。
- **推理分流**：UI／小型功能適用中度；身分安全、跨遊戲整合、正式資料庫、多人同步和支付採高度。對外宣稱的完成仍以測試和部署證據為準。
- **部署**：僅 GitHub 文件更新；未從本次任務重新部署遊戲或 Identity。

## 2026-11-20｜Arcade 六款 MVP 正式合併與 CI 驗收
- **Owner 決策**：D-003；GitHub Issue #3。
- **結果**：六款原創單人遊戲的引擎、介面、測試、遊戲館搜尋／收藏入口與 PWA 資源白名單已合併至 cube1 `main`。
- **合併證據**：[PR #6](https://github.com/luffysky/cube1/pull/6)；main squash commit `21ff117d6542a10a4dbf9a3f5887b6792421a2f3`。
- **測試證據**：整合版 [GitHub Actions 44766629251](https://github.com/luffysky/cube1/actions/runs/44766629251) success；合併後 main [GitHub Actions 44766754938](https://github.com/luffysky/cube1/actions/runs/44766754938) success。包含原有 Web / API / PWA、Identity 核心及六款遊戲單元測試；不等於實機功能驗收。
- **正式網站查核**：本輪環境無法解析 `games.snowrealm.pet` DNS，無法證明 Vercel 正式網址已部署六款；需在受控網路或 DNS 恢復後驗證首頁與每個 `/games/<slug>/`。
- **變更安全**：未操作真實玩家資料庫、未刪除資料、未碰 cube2、不設任何付費方案；Identity 綁定仍關閉。
- **後續門檻**：實際網站開啟、手機瀏覽器觸控/音效/旋轉測試、跨裝置存檔與正式獨立遊戲版本需另外驗收。

## 2026-11-20｜Arcade 其餘四款原創 MVP（開發分支）
- **Owner 決策**：D-003 / Issue #3 六款全做。
- **實際新增**：節奏超載（原創合成節奏、四鍵譜面判定/連擊/延遲校準）；環域逃脫（八方位三層旋轉環形迷宮與出口判定）；重力逆轉（固定網格碰撞、上下重力、三關與重開）；領域爭奪（九節點佔領、能量成本、回合制本機 AI、勝負判定）。每款均有獨立純邏輯引擎、Web 遊戲頁與單元測試。
- **共用平台**：更新遊戲館與收藏 ID 白名單、PWA 快取完整性與對應測試夾具。
- **程式碼／測試**：dist/games/{beat-overdrive,orbit-escape,gravity-reversal,territory-conquest}/、tests/arcade/；以 PR 最新 Actions 運行結果為準。
- **環境與資料**：無正式 DB 變更、沒有刪除或碰 cube2；沒有付費方案、雲端排行或真人對戰。
- **部署與限制**：源碼提交開發分支；正式佈署、iOS/Android 真機、美術/音效品質、跨裝置存檔與伺服器防作弊未驗收，不能把 MVP 當成正式商業版。

## 2026-11-20｜Arcade《折光迷陣》原創光學解謎 MVP（開發分支）
- **Owner 決策**：D-003 / Issue #3 六款原創遊戲。
- **新增**：dist/games/refract-maze/ 中的光束反射引擎、三關旋轉鏡面、提示、重置、過關與 SVG 桌機/觸控/鍵盤操作頁；tests/arcade/refract-maze.test.mjs 的可解關卡、重置與邊界測試。
- **整合**：遊戲館新增可玩卡、收藏、PWA 明確資源白名單和測試用模擬頁。
- **資料與刪除**：未改動正式玩家資料庫、旋界資料、cube2；無刪除或金流變更。
- **驗證**：GitHub Actions 依 PR 實際結果；實機與正式站部署尚待驗收，雲端排名和會員存檔未啟用。

## 2026-11-20｜Arcade《零界閃避》原創單人 MVP（開發分支）
- **Owner 決策**：D-003 六款原創遊戲全部開發；Issue #3。
- **實際內容**：新增 `dist/games/zero-dodge/` 三個檔案（可玩頁、純邏輯引擎、Canvas 操作），支援 60 秒計時、隨時間增加彈幕、三命碰撞、受傷無敵時間、勝負、重開、暫停、鍵盤與指標拖曳、背景暫停、本機最佳分數。
- **平台整合**：`dist/index.html` 新增可玩遊戲卡與實際計數；`dist/app.mjs` 收藏支援 Zero Dodge；`dist/sw.js` 加入安全白名單快取；`tests/arcade/zero-dodge.test.mjs` 新增純引擎測試；CI 增加 Arcade 測試。
- **程式與玩家資料**：只新增遊戲頁與本機記錄；無正式資料庫新增／更新／刪除，無變動 cube2。
- **提交**：分支 `feat/arcade-zero-dodge-mvp-20261120`，PR 內查看所有 commits 與 CI。
- **測試與部署**：已新增自動化測試並交 GitHub Actions 驗證；尚未做手機真人操作驗收或正式部署，不宣稱 Steam/雲端排行已開通。
- **後續**：六款 MVP 源碼均已提交，但各遊戲正式發行、實機互動、多語和正式排行榜仍需後續驗收；跨裝置進度還需 Identity 服務。

## 2026-11-20｜Identity Ed25519／JWKS 基礎（開發分支）
- **Owner 決策**：D-005、D-007、D-008、D-010；Issue #4。
- **實際變更**：建立 identity/authority.mjs（私鑰僅受信任端、平台 UUID、限縮 Brickduel audience/scope、JWT 有效期與嚴格驗簽、即時撤銷狀態失敗拒絕）；identity/app.mjs（公開 JWKS、health，ready=503；無公開簽發路由）；identity/README.md；tests/identity/authority.test.mjs。增加 package.json 測試命令及 Web tests CI。
- **GitHub 分支**：feat/identity-jwks-ed25519-foundation-20261120；程式 commit ef9d8a64，後續測試／文件提交在同分支與 PR 留證。
- **資料庫／刪除／機密**：未修改任何正式資料、schema、玩家資產或 cube2；未執行刪除；未產生正式簽發私鑰，亦未公開服務密鑰。
- **測試**：新增 Node 單元測試並安排 GitHub Actions CI，CI 結果以實際 Workflow 為準。
- **部署**：未部署。identity.snowrealm.pet、OAuth/PKCE、BFF、持久撤銷與兩帳號驗收均未完成；cube2 綁定保持 OFF。
- **回滾**：本 PR 不合併即可撤回，不影響既有玩家與正式登入。

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

## 2026-11-21｜P0 Identity 正式庫唯讀核對與隔離還原

- 基準 main 為 `b290fd9afec8c50880ceb4cb7e7f882f763646fc`。PR #7、#9、#10、#11、#12 已合併，相關 CI 結果與本次環境證據見 [P0 驗收紀錄](IDENTITY_P0_PRODUCTION_VERIFICATION_zh-TW.md)。
- 正式庫唯讀核對 003／004、唯一鍵、外鍵、索引、RLS 及 PUBLIC ACL。快照獨立還原並在演練分支重跑 004，未執行正式分支切換。
- 加入待審的最小權限角色 SQL、RLS/撤銷 readiness 檢查及 Postgres 測試。尚待正式角色核准與配發、可信同意及 BFF 串接、部署和雙帳號驗收。
- 回復方式：本次未改正式資料庫或部署。演練分支不得提升為正式分支。綁定開關依 C-021 維持關閉。
- 授權端要求精確 Origin，交換端將工作階段持有的 state／nonce 與 PKCE 一起原子核對。

## 2026-11-21｜P0 Identity PR #13 合併與正式庫權限交接

- PR #13 已合併，合併 SHA `d546b8245a16bdff94f53b4f7970ea99977c65fa`，[main CI 已通過](https://github.com/luffysky/cube1/actions/runs/44792658198)。
- 正式專用登入、角色與 8 條 RLS 政策已依 Owner 核准建立並做 ACL 核對，沿用既有配置。未重跑角色 SQL。
- 專用登入的連線驗證、憑證與 Function 部署仍待完成。正式網域、跨遊戲 OAuth 和雙帳號驗收尚未執行，綁定維持 OFF。

## 2026-11-21｜Identity HTTP 簽發上線閘門

- Identity Function 目前不接受瀏覽器自行聲明的 consent。授權和交換 HTTP 路徑回 503。readiness 也維持 503，並獨立回報 DB 檢查結果。OAuth 核心、PKCE 和撤銷驗證仍可離線測試。
- production Neon Function 清單只有 cube1api deployment 4。Identity 尚無部署或正式部署機密配置。本次沒有 DB 或 DNS 異動。
- cube2 唯讀查核 main 6199b73。已存在綁定／復原的旗標檢查，尚未找到正式 callback 或 BFF token exchange 路由。
- 仍需完成可信伺服器同意、BFF Session、正式秘密配置與部署。回滾此變更前須維持 Identity 路由未公開，避免恢復前端布林同意放行。

## 2026-11-21｜Identity Function 正式連線與撤銷 API 防護

- 正式連線限定已與 Neon production 核對的 compute（含 pooler）、cube1 與 sr_identity_service。pg 保持憑證驗證，URL query 不得覆蓋 TLS。DB readiness 檢查 session_user 與 current_user。
- 撤銷 API 要求已配置的 BFF 伺服器憑證，拒絕帶 Origin 的請求，成功只回 active。OAuth 簽發與交換依 PR #14 持續回 503。
- 正式尚無 Identity Function。此次未變動資料庫、DNS 或 cube2。若需回滾程式，回到 PR #14 基線並維持授權端點關閉。

- Identity OAuth 在成功比對授權碼的 nonce 雜湊後，把該 nonce 加入玩家 JWT。新增獨立 Admin Ed25519 簽發模組及本機測試。兩者均未接上正式簽發流程。

- PR #17 補齊有效 Ed25519 簽章下的 nonce 拒絕、授權碼一次性與雜湊儲存，以及管理簽發的金鑰、撤銷檢查和時鐘測試。
