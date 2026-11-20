# SnowRealm Games｜Owner 指令、GPT／Claude 權限與強制開發紀錄制度

> **版本：v1.0｜2026-11-20｜核准者：Owner**  
> 適用：SnowRealm Games 平台、《旋界》`luffysky/cube1`、Claude《轉磚》`luffysky/cube2` 與雙方各自管理的遊戲資源。  
> **本文件是 Owner 在 2026-11-20 對話中明確下達的決策紀錄及執行規則，不表示尚未實作的功能已完成。**

## 一、Owner 決策紀錄（按對話順序）

| 編號 | Owner 原話／意思 | 正式執行解釋 | 狀態 |
|---|---|---|---|
| D-001 | 「好 那先A 後面看哪個最多人玩再把那遊戲另外做出App」 | 先以 SnowRealm Games **整合平台 App（方案 A）** 為方向，保留 Web/PWA；有足夠實際使用數據後，選熱門遊戲另行推出獨立 App。沒有要求現在全數重寫原生 App。 | 已決策，開發中 |
| D-002 | 「轉磚現在除了俄羅斯方塊我讓Claude另外寫出其他9款類似風格小遊戲 會在轉磚自己那」 | Claude 負責 `cube2` 旗下十款磚塊系列，不把其程式搬進 `cube1`；透過平台遊戲目錄／登入規格整合。 | 已決策，依各遊戲實際狀態實作 |
| D-003 | 「全做 看起來都好酷 做的出來嗎」 | GPT 的 `cube1` 全做：**折光迷陣、節奏超載、零界閃避、環域逃脫、領域爭奪、重力逆轉**；先各做可玩版本、再整合平台與美術，不得以規劃當作已交付。 | [cube1 Issue #3](https://github.com/luffysky/cube1/issues/3) |
| D-004 | 「我們所有遊戲自己用音效好了 還有配樂 我跟另一個對話討論 你這裡專職遊戲部分」 | **全系列採自家原創 BGM／SFX**；音訊創作由另一對話主責，本遊戲開發對話負責遊戲邏輯、音效事件／程式整合、UI、測試部署。不得把尚未提供的音樂冒充已製作。 | 已決策 |
| D-005 | 「給我允許Claude把轉磚接上SnowRealmGames的文件批下來 註冊登入綁定那些」 | 正式核准 Claude 在 `cube2` 開發 SnowRealm Games 平台帳號導覽、註冊／登入整合、匿名存檔綁定、跨裝置恢復等。正式 Identity 未上線前不得假裝已接通。 | [核准書](./BRICKDUEL_ACCOUNT_INTEGRATION_APPROVAL_zh-TW.md) |
| D-006 | 「資料庫都老子在管」 | **Owner 是所有資料庫的最終所有者與最高治理者。** AI 開發人員只是被授權執行日常工程。 | 已決策 |
| D-007 | 「現在給你們兩個權限 除了刪除 其他編輯更新還有新增不用經過我」 | GPT、Claude 可各自自主**新增、編輯、更新**程式、資料表、非破壞性 Migration 與日常資料，無須逐次請示；**刪除、清空、不可逆抹除與變相刪除必須先取得 Owner 明確核准**。仍不得洩漏金鑰、擅自開通付費方案或擴大高風險權限。 | 已擴權，見核准書 |
| D-008 | 「但做了哪些更改你們自己留log 把我說的都寫進md」 | **GPT 與 Claude 必須自行維護可稽核 Markdown 開發日誌**；所有 Owner 決策、修改內容、資料庫更新、部署結果、測試狀態及未完成事項要有真實紀錄。 | **本文件正式建立此制度** |
| D-009 | 「同視窗 後台幫我記開電腦的時候補」 | 管理後台暫列待辦；待電腦開啟後接續。不能聲稱自動偵測開機或已完成。 | [cube1 Issue #2](https://github.com/luffysky/cube1/issues/2) |
| D-010 | 「快點開」與 Claude 的交接要求 | SnowRealm Identity 列為 P0，由 GPT 補齊正式平台 UUID、授權、JWKS 與撤銷服務；正式安全測試通過前，不可直接強制啟用 cube2 綁定。 | [Issue #4](https://github.com/luffysky/cube1/issues/4)；已開始平台 UUID 程式，正式服務未上線 |
| D-011 | 「玩家按刪除那刻保留30天 30天後刪除 然後用snowrealm網址沒錯」 | 《轉磚》正式回跳域名使用 `brickduel.snowrealm.pet`。玩家本人經驗證要求刪雲端資料後，保留 30×24 小時可恢復期，到期才刪除《轉磚》雲端存檔與平台身分綁定；**Owner 已針對此特定到期刪除流程明確核准**。其他刪除仍需個別核准。 | [30 天資料刪除政策](./BRICKDUEL_ACCOUNT_LINK_AND_DELETION_POLICY_zh-TW.md)；待 cube2 實作 |
| D-012 | 「這只是 games 的 admin，不是整個 SnowRealm；admin.snowrealm.pet 不給過」 | 正式否決將 SnowRealm Games 專用後台設於 `admin.snowrealm.pet`。使用 `games.snowrealm.pet` 下的隨機獨立路徑，前端可以獨立部署，但入口仍走 Games 既有網域的受保護反向代理；必須有 Access／MFA／後端 RBAC，不以隨機路徑當作認證。其他 SnowRealm 業務不屬於 Games 管理員權限。 | 已決策，路由／部署待實作與驗收 |

> 本表僅列本輪可核對的相關 Owner 指令與承接決策，並非聲稱還原全部曾因 ChatGPT 卡住而消失的訊息。新指令要**追加**，不可偷偷改寫舊決策。若 Owner 明確推翻舊指令，新增一筆「取代 D-xxx」，保留原歷史。

## 二、分工與授權

| 項目 | GPT（cube1） | Claude（cube2） | Owner |
|---|---|---|---|
| 遊戲程式、UI、功能、一般部署 | 只在 cube1 自主新增／修改／更新 | 只在 cube2 自主新增／修改／更新 | 監督與最終決策 |
| 自己專案的資料庫新增／非破壞性修改／正常資料更新 | 已授權，需紀錄 | 已授權，需紀錄 | 最高治理權 |
| 刪除資料／表／欄位／資源／repo、清空、不可逆覆蓋 | **必須事前核准** | **必須事前核准** | 親自核准 |
| 遊戲管理與跨遊戲 Identity | cube1 負責平台介面／協定 | 依核准契約做 cube2 Adapter | 治理與驗收 |
| 音效與配樂 | 遊戲內事件和整合 | cube2 遊戲內整合 | 音樂創作在另一對話 |
| 玩家資產與排行 | 自己遊戲獨立 | 自己遊戲獨立 | 擁有治理權 |

**刪除包括「使用 UPDATE 把玩家資料歸零、覆蓋既有存檔、無可逆 Migration 丟掉舊欄位」等實質刪除。** 不得因語法不是 DELETE 就繞過限制。危險的跨帳號轉移、正式資產重分配即使不是刪除也需要嚴格驗證所有權及審計。付費服務、高風險帳戶權限擴大及公開金鑰仍須另外確認。

## 三、強制留 Log 的規則

**每一次有實際變更的工作，都要記錄在自己 Repo 的 Markdown 日誌，與程式碼同次提交或在同一工作完成前補齊。**

- **GPT（cube1）**：`docs/DEVLOG.md`（本次建立），必要時另有設計 Spec／ADR／DB Migration 說明。
- **Claude（cube2）**：沿用既有 `docs/DEVLOG.md`，新增**日期、commit SHA、檔案清單、測試及部署證據**等結構化紀錄。**GPT 不直接修改 cube2**；Owner 將本文件連結交給 Claude 作為正式執行指令。
- **Owner 指令來源**：本文件「Owner 決策紀錄」持續編號 D-010、D-011...；重大技術變更另記 ADR。發現需求衝突先核對最近決策及具體執行邊界。
- 記錄用**台灣時間 Asia/Taipei，且包含 UTC 或 ISO 時間**（能追查即可）。不要把「文件寫了」記成「程式做了」，也不要把 CI 通過記成已完成手機實機驗收。
- **GitHub commit history 不是 DEVLOG 的替代品**：commit 記細節，日誌用一般人看得懂的文字整理原因、實際改了什麼與驗證證據。
- 不在 Log 中包含 Token、API Key、密碼、可識別個資、私鑰或完整連線字串；對敏感資料只記資源名稱與變更類型。

### 每次變更的固定格式（直接複製）

```markdown
## YYYY-MM-DD HH:mm（Asia/Taipei）｜變更標題
- 專案：cube1 / cube2
- 執行者：GPT / Claude
- 關聯 Owner 指令：D-xxx（或 Issue/新決策連結）
- 原因與目標：
- 實際變更：新增／修改／更新了什麼，前後差異
- 檔案／API／UI／資料表：列路徑、端點和表名（不列機密）
- 資料庫：未異動／Migration 名稱；執行環境；是否有備份、是否非破壞性；驗證結果
- 刪除操作：無／Owner 核准來源與範圍（未核准不可執行）
- Git commit / PR：可點開的 URL、SHA
- 測試：命令、通過/失敗數；實機驗證另列
- 部署：未部署／預覽／正式，實際 URL、CI run、驗證時間
- 風險、回滾／復原方式：
- 未完成／阻塞：
- 交接對方的事項：
```

## 四、在每次提交／部署前後必須做的事

1. **開始前**：檢查本 Repo 最新 main、Owner 決策、Issue，避免把新版本覆蓋回舊版。
2. **動手修改**：標示實際修改檔案與功能；涉及新資料庫結構時先查現有 schema、寫可重複執行的 Migration 和測試。
3. **驗證**：執行可用測試；資料庫及外部部署驗證需有真實結果，無法測就標「未驗證」。
4. **留下證據**：commit／workflow URL／部署 URL，禁止寫無法證明的「完成」。
5. **完成時追加 DEVLOG**：一般用戶看得懂的更新說明，再記限制與遺留。
6. **刪除**：先停下來向 Owner 請求具體核准，不可在日誌補一句「已刪除」當作追認。

## 五、本次文件變更（制度啟用紀錄）

- 2026-11-20：Owner 下令「兩位自行留 Log，所有說過的要求寫入 MD」。GPT 新增本文件與 cube1 的 `docs/DEVLOG.md`。
- 本紀錄只記**文件制度建立**，不代表 Claude 已讀取、已修改 cube2、Identity 已上線或已新增資料庫欄位。
- Claude 須在下一次處理 cube2 任務時自行維護自己的日誌；Owner 可將本文件作為正式交接依據。

## 六、關聯文件

- [《轉磚》登入綁定與資料庫擴權核准書](./BRICKDUEL_ACCOUNT_INTEGRATION_APPROVAL_zh-TW.md)
- [《轉磚》玩家 Identity 契約](./BRICKDUEL_PLAYER_IDENTITY_HANDOFF.md)
- [SnowRealm Games 管理後台交接](./SNOWREALM_GAMES_ADMIN_API_BRICKDUEL_HANDOFF.md)
- [cube1 遊戲新增六款 Issue #3](https://github.com/luffysky/cube1/issues/3)
- [cube2 自有開發日誌](https://github.com/luffysky/cube2/blob/main/docs/DEVLOG.md)
