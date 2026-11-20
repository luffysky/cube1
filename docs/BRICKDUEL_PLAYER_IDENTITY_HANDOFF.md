# 《轉磚》玩家登入與存檔綁定

**交付狀態**　雙方可按下表開發及離線驗簽。正式跨站登入、簽發、JWKS、個人資料查詢與撤銷服務待部署。此次查核時，公開 JWKS 的主機無法解析。正式登入網址待公布，目前無法發起真實登入。現有《旋界》會員入口使用 Neon Auth，只服務現有流程。請將 cube2 的跨站登入開關維持關閉，直至兩端以測試帳號完成驗收。

## 玩家憑證

| 項目 | 約定 |
|---|---|
| 登入流程 | Identity 使用 OAuth 授權碼、PKCE S256 和伺服器端 BFF。以精確登記的回呼網址及一次性 state 驗證登入回傳，BFF 保管工作階段與更新憑證。正式授權端點、交換端點與登記的回呼網址在部署後交付。 |
| 簽發者、金鑰 | 預定 `iss=https://identity.snowrealm.pet`，公開 JWKS 位於 `https://identity.snowrealm.pet/.well-known/jwks.json`。由伺服器預設可信來源，僅允許 EdDSA 搭配 Ed25519 公鑰與有效的受保護標頭 `kid`。 |
| 身分與用途 | `sub` 為永久 SnowRealm 玩家 UUID。玩家 token 單獨指定 `aud=snowrealm:brickduel:api`。受理的範圍由各操作在伺服器上指定。建議綁定使用 `brickduel:account:link`，待簽發器與 cube2 同步啟用。管理 token 的獨立 audience 為 `snowrealm:brickduel:admin`。 |
| 時效 | `iat`、`exp` 是整數秒，要求 `0 < exp - iat ≤ 600`。時鐘容差 60 秒，拒絕超出容差的未來 `iat`。建議簽發時帶 `nbf`，收到時須驗證。每次簽發生成唯一 `jti`。 |
| 資料存取 | cube2 先驗簽，再以 `sub` 查自己的綁定。由服務端核對操作範圍、存檔歸屬及撤銷狀態。日誌不得記錄完整 token、Session Cookie 或 Steam Ticket。 |

[Node.js 驗簽範例](../server/api/examples/verify-brickduel-player.mjs) 使用 cube1 `server/api` 已列為依賴的 `jose`。Node.js 24 安裝該目錄的依賴後，可從同一目錄的伺服器端程式匯入。範例呼叫使用已從該次請求取出的 `token`。

```js
import { makeBrickduelPlayerVerifier } from './examples/verify-brickduel-player.mjs';

const verifyPlayer = makeBrickduelPlayerVerifier();
const identity = await verifyPlayer(token, 'brickduel:account:link');
```

這一步只驗證該 token 的簽章、用途、時間和身分。綁定或資產操作還須查詢最新帳號狀態，並由 cube2 驗證該玩家對當地存檔的控制權。可在本機傳入 `jose.createLocalJWKSet({ keys: [testPublicJwk] })` 測試格式。測試解析器和公鑰僅用於離線測試。

## 綁定需要的四個欄位

以下是預定由 Identity 提供給 cube2 的已授權玩家資料物件。欄名採 cube2 管理 API 的 camelCase 慣例。cube2 已公布 `snowrealmPlayerId`，其餘三欄是這次提供的玩家綁定契約。只在綁定用途回傳；公開排行榜與一般管理列表各自維持原有欄位。

| 欄位 | 值及對應 |
|---|---|
| `snowrealmPlayerId` | 必填，與已驗簽的玩家 JWT `sub` 完全相同的 UUID。cube2 自己的 `gameUserId` 對應 `zz.players.id`，兩者在 cube2 用一對一綁定關聯。管理介面對尚未綁定的玩家繼續回 `snowrealmPlayerId: null`。 |
| `displayName` | 玩家允許提供的平台顯示名稱，未設定時為 `null`。可對應原綁定草案的 `display_name`；cube2 已有的遊戲暱稱 `nickname` 優先，平台顯示名稱不能用來認主或合併。 |
| `region` | 玩家自選代碼，未提供為 `null`。沿用 cube2 的 `tw hk mo cn jp kr my sg au us uk other`。不從 IP 或顯示語言推測。 |
| `ageEligible` | `true`、`false` 或 `null`。只表示「依目前適用地區與《轉磚》帳號綁定政策，自填年齡區間是否達標」。資料不足或尚無此地區／用途規則即回 `null`，需要達標的步驟不得放行。此值不能當作年齡證件驗證，也不得推論廣告或付款資格。不回傳生日。 |

現行 cube2 的地區和五段年齡由 `src/consent.js` 保留於裝置。以上約定沒有啟用蒐集、上傳或後台統計。待兩邊確定資料來源、玩家告知與適用規則，才能在正式 Identity 回傳相應值。cube2 只向 Identity 取得綁定所需資料，自行保存帳號與存檔對應。

## 公鑰輪替、撤銷與轉移

- **例行輪替**　Identity 先公布新 `kid` 與公鑰，經過驗證端最長快取期限再切換簽發。舊鑰保留至最後一個舊 token 到期，並加上快取與時鐘容差。缺少可用公鑰或查詢失敗時不得放行。
- **緊急撤銷**　停止以受影響私鑰簽發。通知服務端拒絕該 `kid`、清除快取並使相關工作階段失效。單一 token 可按 `jti` 撤銷，整個帳號則撤銷 session／refresh 並更新撤銷版本。開房、排位、綁定、轉移與資產操作需要可用的最新帳號／撤銷狀態。正式狀態查詢與事件通知端點交付前，敏感流程維持關閉。
- **綁定**　以近期驗證的 Identity 身分與現有裝置憑證證明雙方控制權。cube2 在同一交易中檢查兩側唯一性、寫入綁定、作廢舊匿名憑證和轉移碼並換發裝置憑證。相同綁定重試應回到既有結果，跨帳號或跨存檔衝突回 409 並保留兩份進度。
- **換機與轉移**　已綁定玩家重新通過 Identity 登入，按平台 UUID 找回同一份 cube2 存檔。舊裝置或轉移碼無法單獨取得已綁定的資產。兩份既有進度發生衝突時，由玩家明確選擇並通過雙方所有權驗證後另行處理，不自動覆蓋。Neon 或 Steam 的舊身分使用可信遷移映射；Steam Ticket 僅交由可信任的平台服務處理。
- **上線驗收**　以兩個測試帳號驗證跨站登入、各自資料隔離、重試、換機及綁定衝突。驗證過期、錯 audience、錯簽、撤銷、JWKS 故障時敏感操作皆拒絕。兩套遊戲金幣、排行、資料庫獨立。正式登入與撤銷端點、帶時間的驗收結果由 cube1 交付後，cube2 才開啟對應閘門。

參照 [cube2 管理轉接規格](https://github.com/luffysky/cube2/blob/main/docs/BRICKDUEL_ADMIN_API_ADAPTER_SPEC.md) 與 [cube2 地區及年齡選項](https://github.com/luffysky/cube2/blob/main/src/consent.js)。
