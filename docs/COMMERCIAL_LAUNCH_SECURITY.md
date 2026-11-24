# 商業化發布驗收

以 OWASP ASVS 5.0.0 為基準。PASS 必須附執行環境和證據。程式審查、測試環境與正式驗收分別記錄。

| 核對項目 | 首輪結果 | 證據與下一個驗收條件 |
| --- | --- | --- |
| ASVS V8 授權與管理端預設拒絕 | PASS（本機） | allowlist 本身無法啟用管理 API。非管理員拒絕、唯讀 HTTP 方法與關閉狀態有 API 回歸測試。 |
| ASVS V2 業務邏輯 | PASS（既有本機回歸） | API 組涵蓋錢包、道具、排位、每日任務及冪等。正式與多人併發仍待隔離環境覆驗。 |
| ASVS V6/V7/V9 登入、工作階段與權杖 | BLOCKED（完整環境驗收） | 既有測試涵蓋 issuer、簽章、到期與 Identity 撤銷。須驗證退出、停權後的既有 Games API JWT、換裝置、限流、輪替及回復。 |
| ASVS V1/V3/V4/V8 輸入、瀏覽器與 API | BLOCKED（完整覆蓋） | 須逐路由核對 XSS、CSRF、SQL 參數化、SSRF、所有權與重放，並在隔離 staging 驗證兩個合成帳號。 |
| ASVS V5/V8/V14 R2、資料庫和服務權限 | BLOCKED | 須取得 R2 綁定、上傳限制、角色實際 grants／RLS、cube2 服務 JWT 與正式隔離證據。 |
| ASVS V13/V16 機密和營運 | BLOCKED | 須核對 Secret 存取、告警、遮蔽、備份還原、Cloudflare Access MFA、上游防繞過與實際回滾。 |
| 供應鏈 | PASS（Web/API runtime audit，本機） | CI 拒絕 High/Critical runtime 套件通告。全組件 audit、SAST、staging 動態驗收及正式部署強制檢查仍待串接。 |

## 發布與回滾

- 管理 API 預設關閉。只有經 Owner 核准，且隔離入口、MFA、角色及上游防繞過驗證通過，才能考慮設定 `SNOWREALM_ADMIN_API_ENABLED=true`。
- 部署前記錄最後健康的 Web commit、Neon Function 版本及 Cloudflare Worker 版本。Web 回滾到已驗證部署。Function 或 Worker 發生回歸時還原上一個已知健康版本，再核對健康檢查與一般玩家資料。保留正式設定與資料庫連線，避免套用 staging 設定。
- 回滾 API 時須確認管理路由仍拒絕存取。若舊版本不具備明確開關，需先清空管理 allowlist 才能使用舊版。
- Critical/High 未修復或缺少關鍵驗收證據時，正式金流維持停用。廣告正式啟用須等待金流驗收及可信供應商回呼。各發行平台獨立簽核。
