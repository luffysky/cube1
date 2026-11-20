# SnowRealm Identity｜《轉磚》正式綁定開關的上線前置工作

日期：2026-11-20｜Owner 指令：Claude 已完成 idLink/idRecover，要求 GPT 完成統一登入並協助開通綁定。

## 查核的實際現況

- `cube1/server/api/auth.mjs`：現行 Neon Auth JWT 驗簽，主要對旋界 API 使用。**不是**平台級 OIDC 授權伺服器。
- `cube1/docs/BRICKDUEL_PLAYER_IDENTITY_HANDOFF.md`：定義預期 issuer / JWKS / audience / scope / PKCE / 裝置綁定；明確記載 Identity 尚未上線。
- `cube2/server/identity.js`：存在 Ed25519 JWT 驗證器，需 `IDENTITY_ISSUER`、`IDENTITY_JWKS_URL`、`IDENTITY_AUDIENCE` 與 `IDENTITY_LINK_ENABLED=1`。
- `cube2/server/app.js`：已接 `idStatus`、`idLink`、`idRecover`。開關關閉時拒絕綁定，原匿名進度可使用。
- 目前沒有確認 `https://identity.snowrealm.pet/.well-known/jwks.json` 可用，亦沒有正式發行環境的跨站 OAuth/BFF 端點或撤銷狀態查詢。
- `cube2/docs/BRICKDUEL_IDENTITY_MIGRATION.md` 目前使用 `zz.identity`、`zz.idjti`。注意 `ON DELETE CASCADE` 受 Owner 的禁刪原則約束；既有「刪除雲端資料」不能因此被認定獲得新的刪除授權。

## 必須完成的工程工作

1. **統一平台身分**：登入時驗證既有 Neon Auth session，由平台服務建立/查詢獨立永久 `snowrealmPlayerId`（UUID），新增受控非破壞性映射；不得直接用 Neon `sub` 假冒平台 UUID，更不能用 email 推斷相同玩家。
2. **正式授權服務**：部署 `identity.snowrealm.pet`，實作經過 CSRF/PKCE S256 保護的授權碼流程、精確的 `redirect_uri` 登記、短效 code、一次性 state、nonce；由 BFF 保存 session/refresh，禁止 URL query 或 localStorage 存可長用憑證。
3. **簽名驗證**：使用受控 Ed25519 私鑰簽發 `iss=https://identity.snowrealm.pet`、`aud=snowrealm:brickduel:api`、`scope=brickduel:account:link`、`sub=平台 UUID`、`iat/nbf/exp/jti` 的 JWT，最長 600 秒。僅透過 `/.well-known/jwks.json` 公開 **公鑰**，私鑰不得提交 GitHub。
4. **授權與撤銷**：建立 session/撤銷及服務健康查詢，要求敏感綁定及找回必須可獲得最新撤銷狀態；不能單純因 JWT 簽章正確就允許已停權或撤銷的帳號存取。
5. **跨站最小權限**：`brickduel.snowrealm.pet` 精確回呼網域；機器/管理 audience 與玩家 audience 分開；不共享 Neon/轉磚資料庫密碼。
6. **雙帳號實測**：兩名測試玩家的登入、對應轉磚匿名存檔、另一裝置找回、衝突 409、token 重放、key rotation、撤銷、無網路及錯誤 token；不能覆蓋現有存檔或混合金幣。
7. **最後才開旗標**：由 cube2 專案部署操作者安全設定 `IDENTITY_LINK_ENABLED=1`，並核對真實端點、通過回歸測試。開旗標是部署工作，不應提交永久開啟的測試設定。

## 已核准可自行開發的範圍

Owner 允許 GPT／Claude 在各自 repo 自行新增、編輯、更新，無須逐次請示；不可刪除或變相抹除資料，亦不得自行擴大高風險權限或建立付費方案。所有變更須寫入各自 `docs/DEVLOG.md`，含 commit、測試與真實部署證據。

## 目前狀態

**阻塞中，未開啟正式綁定。** 這份任務單是跨服務實作與驗收清單，並不表示 Identity 已上線。
