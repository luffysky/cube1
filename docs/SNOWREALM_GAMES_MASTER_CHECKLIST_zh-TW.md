# SnowRealm Games｜全專案待辦總表（唯一勾選基準）

**版本**：v1.5 ｜**盤點日期**：2026-11-21（Asia/Taipei）｜**責任範圍**：GPT／`luffysky/cube1`；Claude／`cube2` 僅列跨專案依賴。

> 本文件永久保存 Owner 已確認需求、已交付功能與尚待驗收事項。**[x] 只代表該行描述的「程式／CI／規格」等明確成果已找到證據，不表示其所在系統正式上線。** 例如六款 Arcade 已通過單元測試，不等於 iOS/Android 實機驗收通過；Identity 金鑰模組已測試，不等於 SSO 服務已部署。

## 狀態及更新規則

1. 每次開始開發，先讀本表、`docs/DEVLOG.md`、最近 main 和對應 Issue，避免覆蓋其他協作者的修改。
2. 任一工程事項完成後，在**同次提交或同輪交付前**更新本表勾選和證據、`docs/DEVLOG.md` 的檔案/commit/測試/部署結果；重要任務再更新相關 Issue。**不是在聊天室口頭宣布就算完成**。
3. 實作、CI、部署、實機/多帳號 E2E、對外可販售分別驗收。不得把「寫了 API」當成「已正式上線」。
4. 新需求先增加條目與唯一 ID（`SRG-nnn`），保留既有條目歷史；若取消任務，註明 Owner 決策及原因，不刪除歷史。部分完成要拆成已完成的小項和未完成驗收項。
5. 禁止在本表／GitHub／CI Log 放入 Secret、真實 JWT、Session Cookie、資料庫密碼或玩家個資。
6. Owner D-007：雙方可各自對自己的程式和資料庫做非破壞新增／更新；**刪除、不可逆覆蓋、高風險權限擴大、付費服務**須遵守專案核准制度。cube2 統一由 Claude 編輯，GPT 只追蹤並以對接 API 驗收。
7. 每次提供進度時固定回報：本輪完成／剩餘、具體 SHA／CI、正式部署與實機狀態、阻塞及下一步；**沒有自動背景執行**，下次有進行工作時同步更新。

## 本輪可驗證證據

- Arcade 六款主分支合併：[PR #6](https://github.com/luffysky/cube1/pull/6)，`21ff117d6542a10a4dbf9a3f5887b6792421a2f3`。
- Identity 基礎：[PR #5](https://github.com/luffysky/cube1/pull/5)，測試成功；正式授權未上線。
- 最新檢查到的成功 Web CI：[Actions #44766914423](https://github.com/luffysky/cube1/actions/runs/44766914423)。
- 六款完整原始碼在 `dist/games/`；另有 `tests/arcade/`；遊戲館、PWA、API、桌面工程分別列於下方。
- 受控跨專案工作：[Issue #4](https://github.com/luffysky/cube1/issues/4)（Identity）、[Issue #3](https://github.com/luffysky/cube1/issues/3)（Arcade）、[Issue #2](https://github.com/luffysky/cube1/issues/2)（後台）。

**統計**：51 / 139 條已完成；88 條尚待實作、部署或驗收。統計僅作任務盤點，不代表軟體整體完工率；不同項目的工期與風險不同。

## A｜專案治理、交接與開發流程

狀態：4/7 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P0] cube1 原始碼已完整恢復到 GitHub main，保持與 cube2 分離；現有功能可從主分支核查 <!-- SRG-001 -->
- [x] [P0] Owner D-001～D-011 決策、授權範圍和禁刪規則寫成 Markdown <!-- SRG-002 -->
- [x] [P0] 建立 docs/DEVLOG.md 並在功能變更時記錄測試、commit、部署與阻塞 <!-- SRG-003 -->
- [x] [P0] 建立全專案永久總待辦 Markdown，明確區分程式、CI、正式部署、實機驗收 <!-- SRG-004 -->
- [ ] [P0] 往後每個 PR／部署完成時核對與更新此表、DEVLOG 和對應 Issue；勾選只根據證據 <!-- SRG-005 -->
- [ ] [P1] 定期盤點過時文檔，將舊版「僅 Web/PWA、不做 App」修正為 Owner 最新整合 App A 決策 <!-- SRG-006 -->
- [ ] [P1] 訂定每階段 release gate、版本號與回滾演練，保存驗收記錄 <!-- SRG-007 -->

## B｜SnowRealm Games 平台／入口與 PWA

狀態：5/13 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P1] 遊戲館首頁、搜尋、狀態篩選、我的收藏與最近遊玩基礎功能（原始碼／測試） <!-- SRG-008 -->
- [x] [P1] 遊戲館包含《旋界》《轉磚》及六款 Arcade 入口（原始碼／CI） <!-- SRG-009 -->
- [x] [P1] 《52 HUNT》《NEXT FLOOR》已建立概念介紹頁，未標示已可玩 <!-- SRG-010 -->
- [x] [P1] PWA manifest、離線 shell 白名單、更新提示與離線保護測試（程式／CI） <!-- SRG-011 -->
- [x] [P1] 繁體／簡體／英文／日文／韓文的旋界介面字典（程式／CI） <!-- SRG-012 -->
- [ ] [P0] 核對 games.snowrealm.pet 正式 DNS、TLS、部署版本與六個遊戲頁真實可開啟 <!-- SRG-013 -->
- [ ] [P0] PWA 在 iPhone/iPad Safari、Android Chrome、桌機與已安裝模式實機驗收 <!-- SRG-014 -->
- [ ] [P1] 六款 Arcade 與遊戲館共用的五語、返回入口、教學、錯誤提示與安全區體驗 <!-- SRG-015 -->
- [ ] [P1] 依法告知並取得同意後，建立匿名匯總分析（曝光→首局→復玩、D1/D7、掉線、效能） <!-- SRG-016 -->
- [ ] [P1] 建立可比對 cube1/cube2 的公平 A/B 玩法與留存分析，而非只看累計人數 <!-- SRG-017 -->
- [ ] [P2] 雪域遊戲平台整合 App 方案 A：技術架構、發行渠道與可用版本 <!-- SRG-018 -->
- [ ] [P2] 依真實人氣挑選遊戲推出獨立 App，先確認使用數據再立案 <!-- SRG-019 -->
- [ ] [P2] 遊戲館新增聚合個人頁、跨遊戲展示與可選通知（需正式 Identity） <!-- SRG-020 -->

## C｜《旋界》SPINREALM：玩法、會員與多人

狀態：7/15 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P1] 基礎方塊引擎：SRS、T-Spin、7-bag、Hold、Combo、B2B、下落／消行計分（程式／CI） <!-- SRG-021 -->
- [x] [P1] CPU 對戰、練習、道具派對、自由鍵位、觸控、手把、棋盤擴大（程式／CI） <!-- SRG-022 -->
- [x] [P1] Neon Auth 會員登入前端、會員 API、好友碼／申請／封鎖程式（未等同正式 E2E） <!-- SRG-023 -->
- [x] [P1] 伺服器金幣錢包、唯一帳本、初始 250、每日 50、商城與外觀（程式／測試） <!-- SRG-024 -->
- [x] [P1] 排位佇列、服務端權威比賽模擬、Elo、結算與排行榜 Beta（程式／測試） <!-- SRG-025 -->
- [x] [P1] Cloudflare Workers + Durable Objects 2–4 人好友房程式與部署 Workflow <!-- SRG-026 -->
- [x] [P1] 旋界遊戲內既有背景樂、操作音效與音量控制的程式和素材清單 <!-- SRG-027 -->
- [ ] [P0] 兩位經驗證玩家：正式登入、好友、金幣、商城、排位至結算完整端到端測試 <!-- SRG-028 -->
- [ ] [P0] 重新核查已回報的 Workers 正式 URL、WebSocket 及兩個真實瀏覽器的房間同步 <!-- SRG-029 -->
- [ ] [P0] 排位改進即時長連線，避免 250ms HTTP polling 對 API/DB 產生放量壓力 <!-- SRG-030 -->
- [ ] [P1] 重連與斷線恢復、慢網、重送封包、重放攻擊及玩家資產防作弊測試 <!-- SRG-031 -->
- [ ] [P1] 好友房 1v1／2–4 人完整實機驗收、房主轉移、局間／重開流程 <!-- SRG-032 -->
- [ ] [P1] 40 行挑戰、觀戰、賽後回放與成就系統（未聲稱已有正式功能） <!-- SRG-033 -->
- [ ] [P1] 壓力／成本測試：WebSocket 併發、DO 房間壽命、Neon 結算與異常監控 <!-- SRG-034 -->
- [ ] [P2] 真人多人混戰／組隊／合作模式與反作弊、公平排位規則 <!-- SRG-035 -->

## D｜SnowRealm Identity（P0 上線阻塞）

狀態：12/21 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P0] 定義獨立 SnowRealm 平台玩家 UUID；Neon subject 不直接冒充跨遊戲 UUID <!-- SRG-036 -->
- [x] [P0] sr_platform_identities SQL Migration 檔、映射 Store、已驗證會員註冊／查詢 API（程式／CI） <!-- SRG-037 -->
- [x] [P0] Ed25519 服務端簽發器、精確 audience/scope、短效 JWT 驗證與公開 JWKS 函式（程式／CI） <!-- SRG-038 -->
- [x] [P0] 身分簽章、過期、錯 issuer/audience、停權查詢故障時拒絕、金鑰輪替的單元測試 <!-- SRG-039 -->
- [x] [P0] 確認 003_platform_identity.sql 已在正式庫安全執行、最小權限與備份可用 <!-- SRG-040 -->
- [ ] [P0] 由可信任 Neon Auth session 完成平台 UUID 查找，不信任客戶端自報 user ID <!-- SRG-041 -->
- [ ] [P0] 授權碼 OAuth 2.0 / OIDC + PKCE S256、CSRF state/nonce、精確 redirect_uri 白名單 <!-- SRG-042 -->
- [ ] [P0] 身分 BFF、HttpOnly/Secure Cookie、Session/refresh 管理、短效 code 一次性消耗 <!-- SRG-043 -->
- [ ] [P0] 永續撤銷／停權／token jti 與 kid 查詢、敏感操作 fail-closed 及稽核 <!-- SRG-044 -->
- [ ] [P0] 使用秘密管理服務部署私鑰、金鑰輪替，公開 jwks.json（不得把私鑰上 GitHub） <!-- SRG-045 -->
- [ ] [P0] 部署 identity.snowrealm.pet、確認 DNS/TLS、健康端點、實際授權登入與受控日誌 <!-- SRG-046 -->
- [x] [P0] 已依 cube2 C-022 文件定案 BFF 正式 callback 為 https://brickduel.snowrealm.pet/api/auth/callback（僅路徑規格，路由尚未實作） <!-- SRG-047 -->
- [ ] [P0] 用兩名測試帳號驗證登入、跨裝置恢復、409 衝突、重試、撤銷及金鑰輪替 <!-- SRG-048 -->
- [ ] [P0] 與 Claude 完成雙方驗收後才准由 cube2 啟用 IDENTITY_LINK_ENABLED（GPT 不擅改 cube2） <!-- SRG-049 -->
- [ ] [P1] Steam-only 玩家與 Neon Auth 來源的多身分綁定、遷移與去重策略 <!-- SRG-050 -->
- [x] [P0] 正式 Cube1 Neon 已非破壞性建立 003 身分 UUID 映射表；證明 RLS 與 PUBLIC 權限，玩家錢包未動（獨立備份/最小角色另列未完成） <!-- SRG-134 -->
- [x] [P0] Identity 已完成只在受信任後端使用的一次性授權碼／PKCE 核心、持久化撤銷 Store 與測試程式（未部署/未接 BFF） <!-- SRG-135 -->
- [x] [P0] 已建立正式 Cube1 Neon 手動 Snapshot pre-identity-004-20261121，並已在隔離分支驗證還原 <!-- SRG-136 -->
- [x] [P0] 已依正式 Neon 004 Identity Migration 新增授權碼、停權與 jti/kid 撤銷四張表；四表 RLS=true、PUBLIC SELECT=false，舊錢包帳本筆數未改 <!-- SRG-137 -->
- [x] [P0] 已合併可打包 Node24 的可信 Neon JWT + PKCE/BFF client-secret + 即時撤銷後端 Adapter（原始碼/CI，未正式部署） <!-- SRG-138 -->
- [x] [P0] SnowRealm Games 已建立玩家主動同意的《轉磚》SSO 入口、固定 callback/PKCE 輸入校驗及 Neon JWT 授權請求（原始碼與 CI，未完成正式跨站 E2E） <!-- SRG-139 -->

## E｜六款原創 Arcade（Issue #3）

狀態：7/13 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P1] 零界閃避：60 秒彈幕生存、生命、碰撞、鍵盤／觸控、重開（MVP 程式／CI） <!-- SRG-051 -->
- [x] [P1] 折光迷陣：鏡面反射、三關、提示／重置與終點驗證（MVP 程式／CI） <!-- SRG-052 -->
- [x] [P1] 節奏超載：四軌原創合成節拍、判定窗、連擊、延遲校準（MVP 程式／CI） <!-- SRG-053 -->
- [x] [P1] 環域逃脫：三層同心圓、旋轉出口與關卡（MVP 程式／CI） <!-- SRG-054 -->
- [x] [P1] 重力逆轉：重力方向切換、網格碰撞、三關（MVP 程式／CI） <!-- SRG-055 -->
- [x] [P1] 領域爭奪：九節點、能量／佔領、單人回合制 AI（MVP 程式／CI） <!-- SRG-056 -->
- [x] [P1] 六款都已合併到 main 的遊戲館入口、收藏與 PWA 白名單，Arcade 單元測試進 CI <!-- SRG-057 -->
- [ ] [P1] 六款逐一完成桌機／iPhone／iPad／Android 的真實玩法與觸控驗收 <!-- SRG-058 -->
- [ ] [P1] 玩法深度與平衡：真正可重玩關卡、難度曲線、無解／卡死／刷分漏洞測試 <!-- SRG-059 -->
- [ ] [P1] UI／音效／美術統一成正式電競感，同時保持六款各自辨識度 <!-- SRG-060 -->
- [ ] [P1] 加上五語完整遊戲 UI、可用新手教學、暫停／離線／失敗體驗 <!-- SRG-061 -->
- [ ] [P2] 將每款的本機成績升級為經伺服器可信驗證的排行榜、成就與雲端存檔 <!-- SRG-062 -->
- [ ] [P2] 六款內部玩法迭代與留存衡量，決定哪些發展為獨立作品 <!-- SRG-063 -->

## F｜《52 HUNT》與《NEXT FLOOR》

狀態：2/8 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P2] 《52 HUNT》命運追獵：遊戲館概念頁與設計方向 <!-- SRG-064 -->
- [ ] [P2] 《52 HUNT》可執行規則設計：52 張牌／16 鬼 36 人／保護期／Joker 事件與可驗證勝負 <!-- SRG-065 -->
- [ ] [P2] 《52 HUNT》小型匿名身分切片與權威伺服器，避免隱藏角色資訊洩漏 <!-- SRG-066 -->
- [ ] [P2] 《52 HUNT》逐級多人連線、伺服器壓力／網路驗收後才評估 52 人真局 <!-- SRG-067 -->
- [x] [P2] 《NEXT FLOOR》下一層：電梯 Hub 與不同世界概念頁 <!-- SRG-068 -->
- [ ] [P2] 《NEXT FLOOR》可操作的電梯 Hub + 第一個探索微型世界 + 返回流程 <!-- SRG-069 -->
- [ ] [P2] 《NEXT FLOOR》探索互動、任務、回程存檔、關卡與資源載入／釋放 <!-- SRG-070 -->
- [ ] [P2] 《NEXT FLOOR》手機低／中／高畫質、GPU/context loss 與真機性能驗收 <!-- SRG-071 -->

## G｜會員、商城、廣告、任務與商業化

狀態：5/15 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P1] 商城主題、方塊、棋盤與整頁背景的程式，購買預覽和裝備邏輯 <!-- SRG-072 -->
- [x] [P1] 消耗道具券、伺服器錢包冪等交易與排位不販售競技優勢的規則 <!-- SRG-073 -->
- [x] [P1] 獎勵廣告 15 金幣／日上限 30 次＋Plus 免看同額共用額度的後端邏輯／測試 <!-- SRG-074 -->
- [x] [P1] 真人排位每日任務第一批（+10/+20/+20）後端規則、介面與測試 <!-- SRG-075 -->
- [x] [P1] Plus 自訂圖片本機隔離、背景客製與簽章權益 webhook 的基礎程式 <!-- SRG-076 -->
- [ ] [P0] 獎勵廣告提供商正式核准、網頁端 SDK／原生 SSV 驗證器、完整回放防偽與地區告知 <!-- SRG-077 -->
- [ ] [P0] 正式核對 002_rewarded_ads.sql 的資料庫遷移狀態與 Plus 真實領取端到端 <!-- SRG-078 -->
- [ ] [P1] 訂定 Plus / Pro 會員完整權益矩陣（近期 NT$149／299 月費只是產品提案） <!-- SRG-079 -->
- [ ] [P1] Pro 商城商品全享等權益的發幣／授權成本、濫用防護與玩家公平性評估 <!-- SRG-080 -->
- [ ] [P1] 合法支付服務、退費、取消、續訂、跨渠道權益同步和訂單冪等 <!-- SRG-081 -->
- [ ] [P1] Steam 專屬造型、稱號與搶先體驗版本節奏的驗證規格及實作 <!-- SRG-082 -->
- [ ] [P1] Steam 買斷 US$1.99 左右的定價、平台政策與上架實際確認（不得當成已販售） <!-- SRG-083 -->
- [ ] [P1] Web/App 自願獎勵廣告與免費模式；Steam 版不顯示獎勵廣告 <!-- SRG-084 -->
- [ ] [P2] 外觀商品資源上架流程、季節活動、DLC／支持者名牌與價值驗證 <!-- SRG-085 -->
- [ ] [P2] 成本模型與每月財務 KPI：API/DO/R2、支付、廣告、退款、客服、訂閱 <!-- SRG-086 -->

## H｜管理後台與跨遊戲統一管理

狀態：2/10 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P1] cube1 只讀管理 API（玩家、錢包流水、比賽、近七日趨勢）與權限測試 <!-- SRG-087 -->
- [x] [P1] 管理站 HTML/JS/CSS 原型已移出公開 dist，存 internal/admin-console <!-- SRG-088 -->
- [ ] [P0] 正式站 /admin 舊頁、舊 JS/CSS、CDN 快取全部 HTTP 404/403 驗證 <!-- SRG-089 -->
- [ ] [P0] 建立獨立私人管理 Repo／部署，Cloudflare Access（或同級）與 MFA 限制完整靜態資產 <!-- SRG-090 -->
- [ ] [P0] 後台角色 Owner、Operator、Support、Auditor 逐項 RBAC 與伺服器驗簽 <!-- SRG-091 -->
- [ ] [P0] 管理 API 真正部署、名單權限、403/401/405 與授權過期實測 <!-- SRG-092 -->
- [ ] [P1] 跨 cube1/cube2 的只讀 Adapter 合約、身分與 scope、分頁、審計、錯誤隔離 <!-- SRG-093 -->
- [ ] [P1] 真實後台總覽、趨勢、玩家／金幣／對局報表完整端到端測試 <!-- SRG-094 -->
- [ ] [P1] 高風險管理操作要雙重確認、理由、不可竄改稽核與復原；先保持寫入關閉 <!-- SRG-095 -->
- [ ] [P2] 管理後台 CRM／客服／申訴流程（不得直接共享遊戲 DB 憑證） <!-- SRG-096 -->

## I｜桌面版、Steam 與發行

狀態：2/11 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P1] Electron 安全桌面候選工程、Windows／Linux 打包 Workflow 與安全測試 <!-- SRG-097 -->
- [x] [P1] SteamPipe 模板、繁體外的簡體中文完整 Steam 上架教學 PDF／HTML／MD <!-- SRG-098 -->
- [ ] [P1] Windows/Linux 候選包真機安裝、離線進入、音效、鍵盤、手把、登入實測 <!-- SRG-099 -->
- [ ] [P1] Steamworks 開發者入駐、正式 App ID、App Fee／付款與渠道規則確認 <!-- SRG-100 -->
- [ ] [P1] Steam 身分驗證、Publisher Key 保管、SSO 及長期平台 UUID 映射 <!-- SRG-101 -->
- [ ] [P1] Steam 成就、Steam Cloud、Steam Overlay、Steam 好友與完整回傳驗收 <!-- SRG-102 -->
- [ ] [P1] Steam 專屬外觀／稱號、提前更新測試渠道、正式版本差異與權利管理 <!-- SRG-103 -->
- [ ] [P1] Steam 商店頁、素材、AI 內容揭露、分級、隱私、退款與审核 <!-- SRG-104 -->
- [ ] [P1] SteamPipe 上傳測試分支、從 Steam 客戶端下載、實機驗收 <!-- SRG-105 -->
- [ ] [P2] Steam Deck 操作驗證、正式簽名與 Windows/Linux 發行維護 <!-- SRG-106 -->
- [ ] [P2] 依市場與平台政策決定遊戲中心 App／各遊戲 App 的商店及發布先後 <!-- SRG-107 -->

## J｜原創音樂、音效、素材權利

狀態：2/6 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P1] 《旋界》現有音效素材／配樂和授權檔已包含在原始碼、PWA 與桌面候選工程 <!-- SRG-108 -->
- [x] [P1] 已決定 SnowRealm 全系列採用自家原創 BGM/SFX；音樂由另一個對話主責、遊戲開發負責整合 <!-- SRG-109 -->
- [ ] [P1] 品牌聲音 Logo、首頁 BGM、六款 Arcade 各自完整配樂與操作音效 <!-- SRG-110 -->
- [ ] [P1] 每款戰鬥／UI／獎勵音效事件對應、音量分層、無聲模式、音訊解鎖與背景暫停 <!-- SRG-111 -->
- [ ] [P1] 音效來源、Suno 與人工素材商用權、Steam/App 打包授權和必要署名查核 <!-- SRG-112 -->
- [ ] [P2] 音訊品質與各平台耳機、藍牙、低延遲、切分頁與遊戲狀態驗收 <!-- SRG-113 -->

## K｜安全、隱私、法規、測試與正式運維

狀態：2/13 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P0] 既有 Web／API／PWA／Arcade／Identity 單元測試及 GitHub Actions 綠燈證據 <!-- SRG-114 -->
- [x] [P1] 地區與年齡自選告知、多語隱私／Cookie／條款／未成年文件基礎頁 <!-- SRG-115 -->
- [ ] [P0] 正式資料庫 Migration 已執行清單、備份與回滾，核實無跨遊戲資產混帳 <!-- SRG-116 -->
- [ ] [P0] 正式登入、API、Cloudflare Worker、Vercel、Neon、DNS/TLS 的端到端冒煙測試 <!-- SRG-117 -->
- [ ] [P0] 監控、告警、錯誤率、限流、異常登入、WAF、記錄保留與事件處理制度 <!-- SRG-118 -->
- [ ] [P0] 真實 JWT/Session 失效、弱網、跨帳號操作、CSRF、CORS、XSS 與權限繞過測試 <!-- SRG-119 -->
- [ ] [P1] Cookie/Analytics 僅在必要同意後載入，驗證不同意仍能正常遊玩 <!-- SRG-120 -->
- [ ] [P1] 各發行地區適齡、分級、社交／未成年、廣告與支付法規評估 <!-- SRG-121 -->
- [ ] [P1] 平台帳號查詢、資料下載、更正、刪除與客服處理完整路徑 <!-- SRG-122 -->
- [ ] [P1] cube2 的玩家本人發起刪除：30×24 小時可恢復、期滿才刪除轉磚資料（由 Claude 實作） <!-- SRG-123 -->
- [ ] [P1] 兩遊戲都測試跨帳號隔離、退款／轉移／撤銷後的伺服器權威資產 <!-- SRG-124 -->
- [ ] [P1] 一套可追蹤的發布驗收：桌機、iOS Safari、iPad、Android、已安裝 PWA、Steam 客戶端 <!-- SRG-125 -->
- [ ] [P2] 封閉試玩、玩家回饋、性能調優與商業上架前 release candidate <!-- SRG-126 -->

## L｜Claude cube2 跨專案依賴（僅追蹤，不由 GPT 改 Repo）

狀態：1/7 項已完成（僅限勾選文字描述的明確範圍）。

- [x] [P1] 已正式核准 Claude 開發《轉磚》與 SnowRealm 平台帳號整合，雙方 Repo／資料庫獨立 <!-- SRG-127 -->
- [ ] [P0] Claude 完成／驗證 cube2 的 Auth Adapter、精確 callback BFF、idLink/idRecover 正式流程 <!-- SRG-128 -->
- [ ] [P0] Claude 完成／驗證 30 天可恢復資料刪除、期滿排程、競態與稽核（已核准此特定刪除） <!-- SRG-129 -->
- [ ] [P1] Claude 完成 cube2 下九款追加磚塊風格遊戲的各自程式、CI 與發行驗收 <!-- SRG-130 -->
- [ ] [P1] Claude 提交 cube2 的管理 API Adapter、版本、測試及與平台權限對接 <!-- SRG-131 -->
- [ ] [P1] Claude 與 GPT 驗收不同遊戲金幣／道具／段位／個資不能互相讀寫或覆蓋 <!-- SRG-132 -->
- [ ] [P1] 完成 cube2 更新紀錄與正式部署證據交接，未經查核不標已完成 <!-- SRG-133 -->
## P0 本輪狀態備註（2026-11-21）

- 003 身分表已在經核實的正式 Neon 專案執行，Identity UUID 表現在 0 筆、PUBLIC SELECT=false、RLS=true；未改寫真實玩家錢包。
- OAuth 核心與 004 SQL 草案已提交專用分支，正式 Identity endpoint、Neon session 驗證、BFF、撤銷服務與真實跨遊戲登入仍未部署。
- **歷史紀錄（此項已被後續驗證取代）**：當時 Neon 尚無可見 Snapshot，只有 owner role；後續已建立 Snapshot、完成隔離還原演練並實際使用不繞過 RLS 的 `sr_identity_service` 登入。SRG-040 已完成，跨系統完整備份／發行回滾的 SRG-116 仍待驗收。
- 參考：docs/IDENTITY_P0_OAUTH_REVOCATION_SECURITY_GATE_zh-TW.md。

## 2026-11-21 P0 現場更新

- Neon Snapshot `snap-curly-resonance-b3xxwfup` 建立成功，尚未做 Restore 演練。
- 004 Identity Migration 的 11 條新增結構／REVOKE／RLS SQL 已在 Cube1 production 成功執行；確認 4 張新表均有 RLS，PUBLIC 無 SELECT，wallets=1、ledger_rows=2 未變。
- [PR #9](https://github.com/luffysky/cube1/pull/9) / [PR #10](https://github.com/luffysky/cube1/pull/10) 已併入 main；後者合併後 Actions [44780171358](https://github.com/luffysky/cube1/actions/runs/44780171358) success。
- **Neon 身分服務實際部署未成功**：Neon deploy function 呼叫被工具安全檢查阻止，且缺受控簽名私鑰及專用最小 DB 角色。此狀態不算網域、JWKS、BFF 或跨裝置驗收完成。
- cube2 BFF 仍待 Claude 實作；繼續保持 IDENTITY_LINK_ENABLED=OFF。

## 2026-11-21｜Work 最小權限實際登入驗收（已獨立複核）

- [PR #13](https://github.com/luffysky/cube1/pull/13) 已合併，commit `d546b8245a16bdff94f53b4f7970ea99977c65fa`；主分支 [CI #44792842791](https://github.com/luffysky/cube1/actions/runs/44792842791) success。
- 正式 Neon `raspy-king-43847627`／production `br-winter-thunder-b3ozovl2`／`cube1`：`sr_identity_service` 成功以自身角色實際執行 SELECT，`session_user=current_user=sr_identity_service`，平台 UUID 與授權碼表 `row_security_active=true`。
- 專用登入已有密碼、`BYPASSRLS=false`。8 條 Identity RLS Policy 與最小欄位權限先前已確認；Work 在 [Issue #4 驗證紀錄](https://github.com/luffysky/cube1/issues/4#issuecomment-7049561777) 證實合成資料的 UUID、授權碼建立與消耗、禁讀錢包及禁刪授權碼測試均通過且回滾。
- Snapshot `snap-curly-resonance-b3xxwfup` 存在，PR #13 記錄隔離分支還原演練；因此 SRG-040 改勾選。**這不代表全站災難復原已驗收。**
- `IDENTITY_DATABASE_URL` 與其他秘密尚未配置至正式 Identity Function，沒有實際上線服務；`identity.snowrealm.pet`、BFF、雙帳號 E2E 均仍未完成；cube2 `IDENTITY_LINK_ENABLED` 保持 OFF。

## 推理等級分流

- **中度推理**：CSS、文字、翻譯、基礎組件、單一遊戲小功能、簡單單元測試與低風險修正。
- **高度推理**：Identity／OIDC／PKCE／JWKS／撤銷、跨遊戲綁定、正式資料 Migration、金幣／訂閱權益、多人權威模擬、複雜遊戲演算法、資安與發布事故。
- 若整輪任務跨多個系統，預設採高度；不以「高」當完成證據，仍以 CI、部署、E2E 和可重現資料為準。

## 關聯文件

- [Owner 正式決策與更新制度](SNOWREALM_GAMES_DEVELOPMENT_GOVERNANCE_AND_CHANGELOG_zh-TW.md)
- [開發日誌](DEVLOG.md)
- [Identity 上線閘門](SNOWREALM_IDENTITY_LAUNCH_GATE_zh-TW.md)
- [管理後台安全部署](ADMIN_SECURITY_DEPLOYMENT.md)
- [獎勵廣告、任務與 Plus](REWARDED_ADS_AND_QUESTS_CUBE1_CUBE2_SPEC.md)
- [Steam 上架說明](steam/SnowRealmGames_Steam_Guide_zh-CN.md)
