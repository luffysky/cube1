# 工程用：朋友房對戰模擬基礎

本目錄是 **尚未接上網路 transport 的測試基礎**。它沒有可加入的朋友房，沒有啟動伺服器、配對、WebSocket、帳號驗證或部署入口；現有遊戲 UI 也尚未使用此模組。

`match-simulation.mjs` 直接共用 `dist/games/spinrealm/engine.mjs` 與 `combat.mjs`。不另做第二套旋轉、Hold、出塊或攻擊算法。

## 已實作規則

- 固定 **120 Hz**，一個 tick 為 `1000 / 120` 毫秒；對局時鐘由整數 tick 計算，不讀 `Date.now()`。
- 兩位玩家使用同一 seed、重力與鎖定時間，並各自持有獨立的 `Game` 狀態。
- 呼叫者按照伺服器收到的順序呼叫 `receiveInput()`。模擬器指派 `acceptedTick = currentTick + 1` 和全域 `order`，客戶端不能指定。
- 每位玩家的 `seq` 必須為正安全整數且嚴格遞增；允許缺號，重複與舊序號不再執行。
- 同 tick 的動作依接收順序執行，然後兩方都推進同樣長度的重力／鎖定時間。完成這些步驟後，才呼叫一次 `resolveExchange()`，避免先計算的一方取得抵消優勢。
- 攻擊先抵消舊的待入行數，再互相抵消該 tick 的新攻擊；只計實際送出的剩餘行數。
- 垃圾行延遲 **1500 ms**，到期後仍要等接收方下一次落子；那次落子產生的攻擊會先抵消。
- 擊頂結束；同一 tick 雙方擊頂為平手。未擊頂時，在第 **14400 tick（120 秒）**完成後比較淨送出行數，相同為平手。
- 不提供對戰撤銷、個別暫停或修改對手棋盤的輸入。

這些是旋界試作規則，沒有宣稱為原版 Battle 的精確對戰規則。

## 最小使用方式

```js
import { MatchSimulation } from './server/match-simulation.mjs';

const match = new MatchSimulation({
  seed: 'room-seed-from-server',
  playerIds: ['player-a', 'player-b'],
  rules: { gravity: 700, lockDelay: 500 },
});

const receipt = match.receiveInput({
  playerId: 'player-a',
  seq: 1,
  action: 'hold',
});

if (receipt.ok) {
  // 保存 receipt.input，作為可信任的接收紀錄與重播來源。
  // { playerId, seq, action, acceptedTick, order }
}

const report = match.step(); // 呼叫一次 = 一個固定 tick
// report 包含 applied、兩方 events、exchange、時鐘與結果。
```

動作名稱是 `left`、`right`、`soft`、`hard`、`cw`、`ccw`、`hold`。它們是單次遊戲動作，不是瀏覽器的 `keydown`／`keyup`。

接收成功只代表有效輸入已排入下一個 tick；例如 Hold 正在冷卻，執行時仍可能沒有改變狀態。`report.applied[].changed` 表示實際是否改變，`lastAppliedSeq` 表示已消費的序號。

輸入拒絕會返回 `{ ok: false, error }`，不消耗序號。可能的原因包括 `invalid_payload`、`unknown_player`、`invalid_seq`、`duplicate_or_stale_seq`、`invalid_action`、`tick_input_limit`、`match_ended`。

每位玩家每個待處理 tick 最多排入 32 個動作，防止單次排程無界增長。這項界限不是完整的連線限流或防作弊方案。

## 快照與恢復

```js
const saved = JSON.stringify(match.snapshot());
const resumed = MatchSimulation.restore(JSON.parse(saved));
resumed.step();
```

快照同時具有 `schemaVersion` 與 `rulesVersion`，並保存固定 tick rate、期限和垃圾延遲。恢復時會檢查版本、時鐘、待處理輸入和必要的引擎狀態。改動引擎的出塊、旋轉、計時或快照欄位時，必須同步更新規則／快照版本，不能假設舊快照可繼續使用。

完整內容包括：

- 雙方 `Game` 的全部可列舉實例狀態：棋盤、活動方塊、出塊佇列（包含已抽好的袋內容）、暫存方塊、Hold 冷卻、統計、遊戲狀態。
- 出塊 RNG、垃圾洞 RNG、重力時間、鎖定時間、重置次數、上一個旋轉狀態。
- `events`、`_history`、`_turnStart`，避免復原時丟失目前引擎的隱藏狀態。
- Match 的 tick／時鐘、待入垃圾、淨送出與抵消統計、輸入佇列、最後接收和最後執行的 seq、接收順序計數、結束結果。

快照是深複本；恢復後的 `Game` 會保有原型方法。`restore()` 是伺服器可信任 checkpoint 的工程入口，不接受玩家提交的任意棋盤。

## 已接收紀錄重播

```js
const replayed = MatchSimulation.replay({
  seed: 'room-seed-from-server',
  playerIds: ['player-a', 'player-b'],
  rules: { gravity: 700, lockDelay: 500 },
  inputs: acceptedRecords,
  untilTick: originalTick,
});
```

`inputs` 使用每次成功接收所返回的完整紀錄，保留原本的 `acceptedTick` 和 `order`。重播在相同的 tick 邊界重新接收相同輸入，檢查序號與接收順序。紀錄需要依接收順序排列且全部落在目標 tick 以內；中途恢復則使用 snapshot 後再繼續接收新輸入。

`step(n)` 可在測試中一次推進多個完整 tick；返回最後一個 tick 的報告。正式 transport 若需要每個 tick 的事件，應逐 tick 呼叫並收集報告。

## 驗證

在專案根目錄執行：

```sh
node --test tests/match.test.mjs
```

測試實際比較完整模擬狀態：相同 seed／輸入紀錄的重播一致；中途 JSON snapshot 恢復後，Hold、鎖定計時、後續出塊與垃圾 RNG 繼續一致；同 tick 雙攻擊互抵與接收先後無關；垃圾到期仍須等待落子；120 秒期限／擊頂／無效輸入規則均有覆蓋。

## 尚未實作

目前沒有朋友房 transport、房間生命週期、帳號到玩家身分的綁定、心跳／斷線規則、實際排程器、持久化、客戶端預測或狀態校正，也沒有延遲補償或競技防作弊。

未來 transport 必須從已驗證連線取得 `playerId`，不可直接相信來自客戶端的 player ID；由伺服器接收順序指派 tick。瀏覽器按鍵重複／DAS／ARR 如何轉成可接受動作，仍需另外訂定規則與驗證。不要把這個模組或現有測試通過當作真人朋友房已上線。
