# SnowRealm Games × BRICKDUEL｜廣告獎勵與每日任務共用規格 v1.2

更新日期：2026-11-20。適用於 `cube1` 旋界及 Claude `cube2` 轉磚的規格交接。

## 最新已決定的廣告數值

**每次 15 金幣，每位玩家在各自遊戲內每個 UTC 日最多領 30 次，共 450 金幣。** 經驗證的廣告獎勵和有效 Plus 會員的免看領取共用同一額度。例如當天已看 8 次廣告，升為會員後還能直接領 22 次。

- 每次觀看或領取皆由玩家主動選擇。廣告未填充或驗證失敗，額度不扣。會員逐次領取，伺服器核對當下的有效會籍及剩餘額度。
- 兩款遊戲各自在自己的帳號與錢包內計算額度。當日可領次數取決於實際發幣的紀錄，廣告庫存與收入另計。

## 任務獎勵與廣告分開算

除廣告獎勵外，可透過各遊戲內的**伺服器可驗證事件**領取每日任務金幣。
cube1 第一批已寫程式的任務：
- 完成 1 場有正式伺服器結算的真人排位：+10 金幣。
- 當天完成 3 場正式真人排位：+20 金幣。
- 當天贏得 1 場正式真人排位：+20 金幣。
- 三項合計每日最多 +50 金幣，獨立於每日廣告最多 +450 金幣和原本每日簽到 +50 金幣。
- 只計 `sr_rank_settlements` 經伺服器結算的 `win/draw/loss`；本機 CPU、遊客自報成績、作弊放棄局、未完成的連線場不計。任務獎勵由伺服器錢包流水與每日唯一事件鍵入帳，重試不重複發幣。
- 後續候選：新手引導、合法完成指定模式、達成伺服器成就、季節任務、好友公平對局、活動挑戰。**在可證明反作弊、防多帳號濫領前不要啟用**。
- cube2 可以按自己的可信事件設計任務，不能盲目照搬 cube1 的「真人排位」：依 Claude 回報，cube2 現階段排位實際為打電腦，現有對局紀錄按玩家每場一列，且連線場的證明程度不同。

## 獎勵廣告的正確技術流程

1. 前端僅在年齡／地區與必要廣告同意評估通過、且平台成功提供 rewarded ad 時，向玩家展示清楚的 **觀看廣告得 15 金幣** 提示。
2. 已登入玩家向後端取得短效 `attemptId`。伺服器檢查當日已驗證次數、並發觀看與有效期限。
3. 經玩家**當次明確同意**後請求一則獎勵廣告；不能一次按鈕自動播放 30 則。
4. Google Ad Manager 的 rewarded web 廣告單元設好 SSV URL 後，Google 會在合格的獎勵互動完成時對該 URL 發出 GET。必須由**獨立廣告驗證適配器**先驗證供應商回呼、簽章／參數、時效、伺服器給的 `attemptId` 與不重放，然後才能把可信事件傳給遊戲帳本服務。
5. 伺服器在交易中再次驗證 player、ad unit、attempt、當日上限、唯一 `providerEventId`，只發一次 15 金幣。離線失敗應可查詢確定狀態，不得由客戶端自行填寫 `verified:true`。
6. 付款／訂閱與廣告獎勵區隔；未成年及各地區的廣告資料處理限制需額外合規驗收。玩家拒絕獎勵廣告也可正常遊玩。
7. 若未完成供應商帳號核准、真實 SSV 回呼與廣告個資同意，`enabled=false`，前端顯示尚未開放，後端 `POST /v1/ads/rewarded/start` 回 503，不產幣。

Google 的網頁文件說明 GET 回呼，但未在該頁定義 AdMob 的 ECDSA 簽章參數、公鑰來源或 `custom_data` 格式。開通前需要用受控的網頁廣告單元完成測試，確認驗證規則、玩家與嘗試的綁定、重複通知以及拒絕無效事件。cube2 現有 AdMob 格式驗證器的相容性仍待證實。

`server/api/rewarded-ads.mjs` 現在驗的是「內部廣告驗證適配器」轉交事件的 HMAC，**不是 Google 原生 SSV 回呼本身的驗證程式**。正式啟用前必須補驗證適配器與端到端回放測試。

## cube1 程式及部署狀態

- `server/api/rewarded-ads.mjs`：每次 15，UTC 日上限 30；驗內部受信任適配器的簽名；預設關閉。
- `server/migrations/002_rewarded_ads.sql`：私有嘗試與獎勵事件紀錄表；**待正式資料庫遷移**。
- `server/api/store.mjs`：啟動廣告嘗試、去重、伺服器發幣及每日任務。
- `server/api/app.mjs`：`GET /v1/ads/rewarded/status`、`POST /v1/ads/rewarded/start`、`POST /v1/webhooks/rewarded-ad`（內部適配器專用）；`GET /v1/quests/daily`、`POST /v1/quests/daily/claim`。
- `POST /v1/ads/rewarded/plus-claim` 要求登入、空 JSON 物件及 `Idempotency-Key`。伺服器在交易中核對會員效期與共用額度，成功後寫入錢包流水 `plus_reward`。這條免看路徑可獨立於廣告供應商使用。
- `server/api/quests.mjs`：首批三個真人排位每日任務。
- `dist/games/spinrealm/member-ui.mjs`：錢包內展示共用上限及任務，有效會員可手動領取，廣告觀看按鈕維持停用至供應商串接完成。
- 五語系 `dist/games/spinrealm/locales/game.mjs` 及測試。
- 2026-11-20 已部署 cube1 前端及 Neon Function 第 4 版。API 健康與資料庫就緒探測通過，未登入的獎勵狀態請求回 401。離線 SQL 測試涵蓋共用額度、重送與跨日。正式 Plus 帳號實領仍待驗收；網頁廣告供應商與回呼保持停用。

## Claude 的 cube2 待實作與交付

1. cube2 已回報 `zz.ledger` 與操作 ID 冪等，和存檔在同一交易更新；`zz.matches` 按玩家每場一列保存一年。保留期與正式庫執行狀態仍依 cube2 部署驗收。
2. cube2 的 `GET /api/ad` 是供廣告商回呼的入口。啟用網頁廣告前按上述流程驗收。瀏覽器的 `rewardedSlotGranted` 可提示狀態，發幣須等可信後端事件。
3. 測試兩個來源共用第 30 次、重送回呼、重送領取、跨日和會籍到期。未完成廣告驗證時保持廣告發幣關閉。
4. 各遊戲依自己的伺服器事件設計任務；區分 cube2 的 CPU 排位與 cube1 的真人排位。
5. Steam 版不展示獎勵廣告。會員免看同額獎勵由玩家逐次領取。
6. 同步更新 cube2 的隱私政策、Cookie、廣告供應商與未成年人告知；若現有文件寫沒有廣告，必須在實際載入腳本前更正。
7. 完成後交付 Commit SHA、CI、測試結果、廣告供應商核准與實際 SSV 驗收證據；沒有驗收證據不准說已能賺廣告收益。

## 經濟與產品風險

- **不把每日 30 次視為 KPI**：若用戶疲乏、遊戲內幣過量，反而降低遊玩意願、破壞商店定價或無法取得足夠的廣告庫存。
- 評估廣告填充率、完成率、ARPU、DAU/留存、廣告觀看後退遊率、遊戲內金幣總發行量、商店消耗率、詐欺率以及帳單。
- 建議保留後端可調低上限的緊急停用開關，但任何調整必須符合玩家已明確看到的獎勵提示，不可中途偷偷減少已完成廣告的約定獎勵。
- 任何涉及金流、監護人同意及地區廣告定向，都需要實際營運合規判斷。

## Google 官方文件

- 2026 年發布存檔，11 月 2 日條目記載 rewarded web SSV 自 10 月 29 日起提供：<https://support.google.com/admanager/answer/16817645?hl=en>
- AdMob Android SSV 是行動應用程式驗簽文件：<https://developers.google.com/admob/android/ssv>

- Google Ad Manager rewarded web：<https://support.google.com/admanager/answer/9116812?hl=en>
- Google 獎勵廣告政策：<https://support.google.com/admanager/answer/7496282?hl=en>
- Ad Manager 格式頻率控制：<https://support.google.com/admanager/answer/9387317?hl=en>
