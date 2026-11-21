# 2026-11-21 聯合驗收紀錄

環境：隔離 staging 尚未配置。cube1 main `b2ba819`，測試程式見 PR #17。cube2 main `07767a1`。以下均未送出 staging HTTP 請求，尚無執行時間、URL、HTTP 回應或證據。

| Case | 預期結果 | 結果 | 阻塞 |
|---|---|---|---|
| A1 | 200，欄位照 handoff v0.2 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A2 | 401 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A3 | 401 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A4 | 403 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A5 | 403 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A6 | 401 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A7 | 200（最多 1 分鐘內生效） | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A8 | 快取過期（≤10 分鐘）後 401 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A9 | 503 `unavailable` | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A10 | 401 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A11 | 200（唯讀可以重複用） | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A12 | 429 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A13 | 405 | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| A14 | 有 A1–A12 的 `sub/jti/path/status`，沒有 token | BLOCKED | 待隔離 Admin signer、JWKS 與 Preview 信任設定 |
| B1 | `linked`，裝置換新金鑰 | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B2 | `recovered`，同一份存檔 | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B3 | `conflict`，兩份存檔、金幣都不變 | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B4 | `token` | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B5 | `token` | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B6 | `replay` | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B7 | `expired` | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B8 | `session` 或 `state` | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B9 | `revoked` | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B10 | `unavailable` | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B11 | `denied` | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B12 | `recovered`，刪除取消 | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
| B13 | 不受影響 | BLOCKED | 待隔離 Identity、可信同意、Preview 與合成帳號 |
