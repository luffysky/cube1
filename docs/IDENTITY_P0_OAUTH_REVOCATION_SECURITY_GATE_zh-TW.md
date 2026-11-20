# SnowRealm Identity｜P0 OAuth 與撤銷工程上線閘門

更新：2026-11-21。此文件僅為工程狀態與安全規格，不是正式登入已上線證明。

## 已有程式（尚未部署）
- identity/oauth-core.mjs：可信後端的 90 秒一次性 authorization code、S256 PKCE、精確 callback allowlist、300 秒 JWT 交換。沒有 HTTP 路由。
- identity/oauth-store.mjs：Postgres 原子消耗 code、停權與撤銷狀態的只讀檢查。
- server/migrations/004_identity_authorization.sql：新增 authorization code、account status、jti、kid 的非破壞性 Schema **草案**。正式庫尚未執行。
- identity/authority.mjs：status callback 新增簽署的 issuedAt 讓 revoked_after 可安全檢查。
- tests/identity/oauth-core.test.mjs 與 tests/api/identity-schema.test.mjs：離線與 Postgres/WASM 規則測試。

## 絕不提前啟用
- 本模組不是完整 OAuth 2.0 / OIDC 伺服器。沒有 /authorize、/token 正式端點、Neon Session BFF、CSRF/同意 UI、session refresh 或機器身分驗證。
- verifiedSubject 只能由受信任的 Neon JWT 驗簽器提供，不得來自前端的自報 user ID／Email。
- consentGranted 必須由後端新近核實使用者操作，不得相信客戶端傳 true。
- 真正的回呼路徑必須由 Claude/cube2 BFF 交付並審核。本階段測試中的 callback path 只是測試範例，不得直接登記生產 redirect。
- Code 只存 SHA-256 hash，消耗採原子 UPDATE WHERE consumed_at IS NULL；不可用於反覆交換。驗證器還需要 live revocation check 和 cube2 的交易型 jti 單次使用。
- 簽發私鑰不可進 GitHub、前端、log、聊天室；尚未有 Secret Manager 生產私鑰和 JWKS 正式服務。
- 正式停權／撤銷的寫入須有後端 RBAC/MFA/審計；本階段沒有公開管理寫入端點。

## 已核實的 Neon 正式庫
- 專案 SnowRealmGames-Cube1：raspy-king-43847627；正式 production branch br-winter-thunder-b3ozovl2；資料庫 cube1。
- 003_platform_identity.sql 已執行非破壞性建表、REVOKE PUBLIC 與 ENABLE RLS。檢查結果：表存在、唯一索引存在、RLS=true、PUBLIC SELECT=false、identity 表 0 筆。
- 舊表檢查時 wallets=1、wallet ledger=2。未更新這些資料。
- 沒有可見獨立 Neon Snapshot；備份/恢復未驗收。DB 目前使用 owner role（可繞過 RLS），尚待最小權限角色設計。
- 另有同名但不同的專案 steep-smoke-93587055；這次完全沒有更動。

## 尚未完成的正式 Gate
- [ ] 004 Migration 在隔離測試與正式部署，建立可驗證備份、最小角色權限、回滾計畫。
- [ ] 可信 Neon session → SnowRealm UUID → 授權碼/PKCE → BFF cookie 與撤銷服務的完整認證鏈。
- [ ] cube2 精確 callback、客戶端身分、反重放與跨裝置存檔衝突驗收。
- [ ] identity.snowrealm.pet DNS/TLS、Secret Manager、JWKS 先發布再輪替、正式健康檢查。
- [ ] 兩個測試帳號、錯誤 token、停權、換機、金鑰輪替、409、離線、錢包隔離 E2E。
- [ ] 所有門檻通過後才由 cube2 部署者啟用 IDENTITY_LINK_ENABLED；GPT 不更動 Claude Repo。

標準參考：https://www.rfc-editor.org/rfc/rfc9700.html 、https://www.rfc-editor.org/rfc/rfc7636
