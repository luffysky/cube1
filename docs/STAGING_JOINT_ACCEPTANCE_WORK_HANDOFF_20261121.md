# SnowRealm Games × BRICKDUEL｜P0 Staging 信任鏈與 27 項聯合驗收交辦

**交辦給：** ChatGPT Work（只修改 `luffysky/cube1`）；Claude 負責 `luffysky/cube2` 的 Preview 對接。  
**日期：** 2026-11-21（Asia/Taipei）  
**優先級：** P0／安全相關／直接執行已授權的非破壞性工程，保留變更與測試證據。  
**唯一原則：** staging 與 production 完全隔離，不要為了通過測試放鬆正式環境授權。

## 0. 立即讀取與已核對基線

| 項目 | 已核實內容 |
|---|---|
| cube1 main | `b2ba819a9a294ac213942208e5aa507ede4c1aeb`（開始操作前重查最新 HEAD） |
| cube1 Draft PR #17 | `ef783e4b6799fbfb9f69c0f172e960821e393486`，未合併 |
| PR #17 CI | [#44841257885](https://github.com/luffysky/cube1/actions/runs/44841257885) **success** |
| cube2 main | `07767a17f3e99afa543471c8988bd7a13b178ad4` |
| cube2 C-036 變更 | `b20f52116afe493a7c1f43367a5f36546dbf2e75`，BFF nonce 必填、管理 sub 固定、只讀清理監測 |
| cube2 CI | [#44840380067](https://github.com/luffysky/cube2/actions/runs/44840380067) **兩項 jobs success** |
| 正式 Neon | Project `raspy-king-43847627`，production `br-winter-thunder-b3ozovl2`，DB `cube1` |
| Neon Functions | Production 目前只看到 `cube1api` deployment **6**；**尚無獨立 Identity Function** |
| Neon Branch | Production 與 `identity-p0-restore-drill-20261121`；**還沒有專用 staging Identity 分支** |
| 主待辦 | `docs/SNOWREALM_GAMES_MASTER_CHECKLIST_zh-TW.md`，上次核實 **56/144**，不可因草稿／測試預支正式上線成果 |

**必讀來源：**
- [cube2 的 A1–A14／B1–B13 清單](https://github.com/luffysky/cube2/blob/main/docs/JOINT_ACCEPTANCE.md)
- [cube2 現有 BFF](https://github.com/luffysky/cube2/blob/main/server/bff.js)；[管理唯讀 API](https://github.com/luffysky/cube2/blob/main/server/admin.js)
- [cube1 PR #17](https://github.com/luffysky/cube1/pull/17)，[Issue #4](https://github.com/luffysky/cube1/issues/4)，[Issue #2](https://github.com/luffysky/cube1/issues/2)
- `identity/oauth-core.mjs`、`identity/authority.mjs`、`identity/admin-authority.mjs`（PR #17）、`identity/neon/index.mjs`、`identity/neon/trusted-app.mjs`
- `dist/sso-flow.mjs`、`dist/sso-bridge.mjs`、`docs/DEVLOG.md`、60 頁管理後台 Spec。

## 1. 立刻完成 PR #17 的程式整合，但不急著合併草稿

- 現有 nonce／JWT 的有效 Ed25519 簽章反向測試已完成，不重寫既有 30 項本機測試。
- 補齊真正的可信同意交易（Neon Auth 已驗證個人 Session + 伺服器端確認的使用者明確同意 + CSRF/state/nonce + PKCE），不能用瀏覽器傳入 `consent:true` 充當授權。
- 在安全流程完成前 `POST /oauth/authorize`、`POST /oauth/token` 與完整 `/health/ready` 仍 fail-closed；staging 通過後再用獨立環境的安全 Gate 逐步驗收。
- Admin JWT `canIssue(kid)` 必須接真正可信、持久化的**管理金鑰撤銷**來源，不得只有測試 stub；Admin 與 Player 私鑰、`kid`、JWKS、audience、scope 完全分離。
- 只讓**已驗證的 Games 管理端 BFF**請求 Admin 機器 JWT。不可新增會讓瀏覽器、普通玩家、任意 Bearer Token 取得 Admin JWT 的公共端點。Admin 發行、拒絕、撤銷皆須稽核，不記載 Token 或 Private Key。
- 與平行 [PR #16](https://github.com/luffysky/cube1/pull/16) 比對最新 base，避免覆蓋管理後台修改。每次推送重新執行完整 GitHub CI，修完後再按程式審查結果合併。

## 2. 建立**真正隔離**的 staging 設定

- 不要把目前的 production Snapshot 還原演練分支直接當成含真實玩家資訊的測試環境。使用獨立 staging 資料庫或隔離分支，**只放合成測試帳號和資料**，權限最小化；不得寫入正式玩家／錢包資料。
- 若新 Neon branch、compute、DNS、Cloudflare／Vercel 配置會產生費用或高風險權限擴張，先要求 Owner 確認；不要假裝可免費部署。
- Staging 使用不同的資料庫帳號、Identity Ed25519 私鑰與 `kid`、Admin Ed25519 私鑰與 `kid`、BFF Client Secret、管理員 allowlist 和獨立 Session。
- 建議 staging 服務以受控 HTTPS URL 提供；取得**實際部署 URL**後登記在驗收文件，不能臆造地址。
- 秘密只經已認證控制台／秘密管理注入；絕不複製到 GitHub、交辦 MD、聊天、log、測試快照。

## 3. Staging callback 的正式選擇及路由改造

**優先選擇 A：** 以獨立、安全受控、TLS 驗證的 staging 網域建立精確回呼，例如：

`https://brickduel-staging.snowrealm.pet/api/auth/callback`

此僅為**提案網址，不代表 DNS、Vercel Preview 或憑證已存在**。若管理規則不允許新網域，可選擇已取得的 Vercel Preview HTTPS 網址作精確白名單，但必須限制在 staging 的 issuer/client 設定內，不能讓正式 issuer 接受任意 `.vercel.app`。

已發現 hardcode：
- cube2 `server/bff.js`：`REDIRECT='https://brickduel.snowrealm.pet/api/auth/callback'`。
- cube1 `dist/sso-flow.mjs`：只允許正式 `brickduel-bff` 與正式 callback；`dist/sso-bridge.mjs` 亦將請求送到正式 Identity。
- cube1 `identity/oauth-core.mjs`：正式 callback 註冊的 URI 白名單與 `.snowrealm.pet` 驗證。

**要求：** Claude 只修改 cube2 的**Preview／staging** callback、Client ID、Portal URL 與 Cookie 域名處理；Work 修改 cube1 的**staging** Portal／Identity Client 登記與最小允許清單。正式域名與正式 Callback 仍保持原有精確值，絕不能以 wildcard 取代。Preview Cookie 的 `__Host-` 前綴必須保持 host-only、Secure、HttpOnly，並以真實瀏覽器測試跨站回跳。

**禁止改動：** 不得為了 staging 將 production `IDENTITY_LINK_ENABLED` 暫時打開；不能使用正式玩家帳號／資料庫做沒有回滾方案的流程試驗。

## 4. Cube1 必須交付的 2 條信任鏈

### A. 管理員 JWT／Admin JWKS

1. 受 Access/MFA 及 Games 管理員個人 JWT／RBAC 驗證的機器簽發服務；只有被核准的內部 BFF 可以取得短效 token。
2. **獨立 Admin Ed25519 金鑰**，staging 的 `/.well-known/admin-jwks.json` 只發布公開 JWK（無 `d`）。
3. 機器 JWT `sub=svc:snowrealm-games-admin`、`aud=snowrealm:brickduel:admin`、`scope=brickduel:admin:read`、`exp-iat=300`、`jti` 唯一；支援 kid 撤銷、雙鑰輪替、故障拒簽。
4. Cube1 管理後端先驗使用者，再以服務機器 JWT 呼叫 cube2 七支只讀 Admin API；不得將機器 JWT 送到瀏覽器。
5. 與 Claude 的 Preview JWKS／`BRICKDUEL_ADMIN_SUBJECTS` 完成有效 200、無效 401/403、故障 503、限流 429 與 no-store／no CORS 驗收。

### B. 玩家 Identity OAuth／BFF

1. Staging 的可信 `/oauth/authorize`、`/oauth/token`、`/v1/token/status`，以及玩家 `/.well-known/jwks.json`。
2. 兩組**獨立、已驗證的 staging 測試身分**，兩個隔離的裝置／瀏覽器 Session；不在聊天分享帳密或 Token。
3. OAuth Code 僅 90 秒、PKCE S256、state／nonce 綁定，同意取消與逾時安全處理；`nonce` 必須是玩家 JWT claim 且等於 BFF session 原值。資料庫僅留雜湊。
4. BFF 使用其獨立密鑰驗證 Client Secret，服務端交換 Code，做 JWT/JWKS／kid／撤銷查詢；玩家金幣／段位／存檔不跨遊戲混合。
5. 不可接受只跑本機 fixture、或由人工偽造 200 的「正式 E2E 通過」報告。

## 5. B4「有效簽章但缺 nonce」的安全測法

**不要在 production Identity 加 `ALLOW_MISSING_NONCE` 或 `SIGN_INVALID_TOKEN` 開關，也不要放出公共 staging mint-test-token API。**

改在**隔離的安全測試 Harness**使用一把與任何正式金鑰完全不同的 Ed25519 測試私鑰，簽出一張有效簽章但不含 nonce 的 Token；相對的測試 JWKS 只允許該 Harness／私有測試部署使用。將它送進 staging cube2 的受控 BFF 驗證程序，應得到 `token`，不可進入 `idLink`、不可建立裝置金鑰或覆蓋存檔。必要時由受保護且不公開的測試替身模擬 Identity Token 端回應，並在報告明確標示「受控 staging 錯誤注入測試」而非正式 issuer 發出無效 token。

正式端絕不允許由任何設定開關發行缺 nonce 的 JWT。

## 6. cube2 聯合驗收：A1～A14／B1～B13 全數留證

實際依 `cube2/docs/JOINT_ACCEPTANCE.md` 執行，以下是驗收分組，不得漏項：

| 群組 | 測試編號 | 必須記錄的真實結果 |
|---|---|---|
| A 正向管理唯讀 | A1、A7、A11、A14 | 七支 GET 200、換鑰、同 token 可唯讀重用、稽核不記 Token |
| A 反向安全 | A2～A6、A8～A10、A12～A13 | issuer／aud／scope／sub／kid／時間拒絕、移除舊鑰、JWKS 故障、限流、POST 拒絕 |
| B 登入綁定與恢復 | B1～B3、B12～B13 | 連結、另一裝置找回、409 不覆蓋、30 天內恢復、匿名仍可正常玩 |
| B 錯誤與防重放 | B4～B11 | 缺／錯 nonce、重放、超時、跨瀏覽器、不活躍／撤銷、503、取消授權 |

每項寫入：`caseId`、UTC 時間、staging URL、HTTP 狀態及匿名化回應、cube1 SHA、cube2 SHA、執行者、證據 URL、`PASS/FAIL/BLOCKED`。**不能因本機測試成功就勾成雙端 staging PASS。**

## 7. 交付與回報格式（直接實作，不要只寫規劃）

- 新增／更新 `docs/DEVLOG.md`、`docs/SNOWREALM_GAMES_MASTER_CHECKLIST_zh-TW.md`、[Identity Issue #4](https://github.com/luffysky/cube1/issues/4) 及必要的 [後台 Issue #2](https://github.com/luffysky/cube1/issues/2)。
- 在 cube1 新增 `docs/JOINT_ACCEPTANCE_RESULTS_20261121.md` 或等效檔案，保留 **27 項逐項結果**與明確測試環境；暫時 BLOCKED 的項目照實填。
- 實際 GitHub PR、SHA、CI、Neon Function deployment ID、原生 Function URL、正式／staging DNS/TLS、JWKS response 的 `kid`、ready/dbReady、無機密的截斷測試輸出都需列出。
- **已完成**、**僅原始碼／CI 通過**、**staging 驗收 PASS**、**production E2E PASS** 必須分開。
- 使用 Owner D-012 決策：Games 後台入口留在 `games.snowrealm.pet` 的隨機受保護路徑，不使用 `admin.snowrealm.pet`；此規劃不阻止另設必要的 staging 測試域名。
- 不得刪除、清空、覆寫正式資產、分享機密、開付費、授予高風險權限；新付費／不可逆操作先請示 Owner。

**最優先實際成果：** 先讓 cube1 提供安全可驗證的 staging signer、Admin JWKS、OAuth/Status 端點及兩個 staging 測試身分，讓 cube2 在 Vercel Preview 完成 A1–A14／B1–B13。完成 staging 後再制訂正式上線審核，不能用 CI 綠燈代替跨設備真實驗收。