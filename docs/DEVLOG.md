# SnowRealm Games / cube1 開發日誌

這份文件由 GPT 維護；Claude 的 `cube2` 請自行維護其 [docs/DEVLOG.md](https://github.com/luffysky/cube2/blob/main/docs/DEVLOG.md)。

**正式制度**：[Owner 決策與強制開發紀錄規範](./SNOWREALM_GAMES_DEVELOPMENT_GOVERNANCE_AND_CHANGELOG_zh-TW.md)。

## 2026-11-20｜建立開發紀錄制度

- **執行者**：GPT（cube1）
- **Owner 指令**：D-008，「但做了哪些更改你們自己留log 把我說的都寫進md」。
- **目的**：讓使用者日後能追查 GPT 和 Claude 分別更改了哪些功能、資料庫結構、部署設定及是否真的通過測試。
- **實際新增文件**：
  - `docs/SNOWREALM_GAMES_DEVELOPMENT_GOVERNANCE_AND_CHANGELOG_zh-TW.md`：按時序整理 Owner 的明確決策、兩邊授權、禁刪限制、日誌範本與紀錄義務。
  - `docs/DEVLOG.md`：從本次開始，cube1 後續每次實際改動都在這裡追加。
- **程式與資料庫**：本次只新增 Markdown 文件，沒有遊戲功能、資料庫結構或玩家資料的變更，也沒有進行刪除。
- **部署**：未由本次工作部署任何程式或資料庫。
- **驗證**：GitHub 建檔回報 commit，尚無實機遊戲驗收；本次為文件工作，沒有宣稱測試已通過。
- **追蹤**：Claude 專案的既有日誌由 Claude 自己更新；GPT 未修改 cube2。
- **下一步**：各自後續提交需記原因、檔案/API/DB、commit、測試、正式/預覽部署、未完成事項。以前的提交歷史可逐步補記，但未經核實不可捏造。

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
