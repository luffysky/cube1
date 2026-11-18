# SnowRealm Games 后端与 API 交接

更新：2026-11-18。当前阶段：持久化账户、经济与真实双人排位测试版。

## 真实能力与边界

后端采用 Neon Postgres、Neon Managed Better Auth 和 Node.js 24 Neon Function。账户、钱包、商品所有权、好友、排位分与对局检查点保存在专用数据库。浏览器只能提交操作，不能提交可信金币、排位结果、棋盘、随机种子或服务器时间。离线练习/CPU 对局成绩保存在设备上，不兑换云端金币。

双人排位有真实队列，等待另一位已登录玩家；不会用 CPU 冒充真人。当前传输为每 250 ms 轮询与批量输入，适合验证规则和完整账户流程。全球低延迟正式赛事仍需区域路由、WebSocket 房间实例、输入预测/校正、并发压测与异常行为检测。HTTP 输入最多每秒 15 次、120 个动作，每批最多 32 个；对局 120 Hz 固定步长、最长 120 秒。待匹配心跳 15 秒过期，对局心跳 20 秒判离线。

订阅没有接通支付平台，`billingAvailable` 永远为 `false`，结账返回 `billing_unavailable`。会员资格只能由已验证的服务器付款适配器签名事件写入。不会显示假付款成功。自定义图片在当前设备 IndexedDB 保存，启用时检查真实会员权利；数据库不存大图或任意外部图片 URL，也未宣称支持跨设备图片同步。

## 运行与部署

1. 在专用项目执行 `server/migrations/001_accounts_ranked.sql`。迁移仅新增 `sr_*` 表，启用行级安全，无浏览器直连表授权。函数使用表所有者角色，所有 API 查询都以验证后的 JWT subject 授权。
2. `cd server/api && npm ci && npm test && npm run build`。
3. 将 `server/api/build/index.mjs` 放在 ZIP 根目录。Neon Functions 入口必须命名 `index.mjs`；运行时选择 `nodejs24`。构建脚本包含 pg 的 CommonJS 兼容 banner。
4. 环境：Neon 注入 `DATABASE_URL_UNPOOLED`/`DATABASE_URL`、`NEON_AUTH_BASE_URL` 和 `NEON_AUTH_JWKS_URL`。`ALLOWED_ORIGINS` 为逗号分隔的精确 Origin，不包含路径或通配符。浏览器不得得到数据库连接串、管理员密钥、支付密钥。
5. JWT 的 issuer 是 `new URL(NEON_AUTH_BASE_URL).origin`，不是带数据库路径的完整认证地址。签名限定 EdDSA，验证 exp、iat、sub。若部署明确签发 audience，再配置 `AUTH_AUDIENCE`。
6. `ENTITLEMENT_WEBHOOK_SECRET` 默认留空。未配置时服务器签名适配入口也返回不可用。

已固定版本：pg 8.23.1、jose 6.2.17、@neon/functions 0.11.0、esbuild 0.28.2。PGlite 0.5.16 仅用于测试，不进入运行时。

## HTTP 约定

除 `/health`、`/health/ready`、`/v1/catalog`、已签名服务器事件外，必须发送 `Authorization: Bearer <Managed Auth JWT>`。`/health` 只证明进程运行；`/health/ready` 使用函数实际注入连接，检查数据库名称等于 `EXPECTED_DATABASE`（默认 `cube1`）且 `sr_profiles` 存在，只返回 `{ready:true}`（200）或 `{ready:false}`（503），结果在函数实例内缓存 5 秒，不暴露数据库名、连接串或 SQL 错误。所有响应包含 `Cache-Control: private, no-store`。成功响应直接是 JSON 对象，无额外 `data` 包装。错误为：

```json
{"error":{"code":"insufficient_coins"},"requestId":"..."}
```

客户端翻译 `error.code`，不把数据库错误或英文 exception 显示给用户。429 同时返回 `Retry-After`；签名错误 401、所有权错误 403、他人或不存在的比赛统一 404。写入 body 必须是 JSON；普通请求最多 32 KiB。未知字段被拒绝。

金币领取、购买和道具使用必须带 `Idempotency-Key`（8–100 个字母/数字/下划线/冒号/点/短横线）。同一次点击的网络重试必须复用同一个 key；下一次不同购买创建新 key。相同 key 配不同商品/数量返回 409，不会重复扣款。

## 个人资料与经济

| 方法 / 路径 | 请求 | 返回 |
|---|---|---|
| GET `/v1/profile` | 无 | `profile,wallet,inventory,ownedCosmetics,appearance,entitlement,rank,daily` |
| PATCH `/v1/profile` | `{nickname?,locale?,appearance?}` | 完整资料 |
| GET `/v1/catalog` | 无需登录 | `version,items,economy,membership,rankedItemsAllowed:false` |
| POST `/v1/wallet/daily` | `{}` + 幂等 key | `{wallet:{balance},granted,alreadyClaimed,day}` |
| GET `/v1/wallet/history` | 无 | 最近 50 条 `{entries:[{id,delta,balanceAfter,reason,metadata,createdAt}]}` |
| POST `/v1/shop/purchase` | `{itemId,quantity?:1}` + key | `{purchased:{itemId,quantity,spent},wallet:{balance}}` |
| POST `/v1/inventory/use` | `{itemId,mode:"party"}` + key | `{used,quantity,effect,mode, trustedMatchReward:false}` |
| POST `/v1/billing/checkout` | 不可用 | 503 `billing_unavailable` |

资料字段：

```json
{
  "profile":{"id":"verified-sub","nickname":"Player ABCDE","friendCode":"ABCDEF234567","locale":"zh-Hant"},
  "wallet":{"balance":250},
  "inventory":[{"itemId":"shield","quantity":2}],
  "ownedCosmetics":["theme:obsidian","theme:snow","blocks:classic","blocks:flat","board:grid","board:plain","background:solid"],
  "appearance":{"theme":"obsidian","blocks":"classic","board":"grid","background":"solid","boardOverlay":0.72,"customBackgroundEnabled":false,"customTarget":"background"},
  "entitlement":{"plus":false,"customImages":false,"plan":"free","expiresAt":null,"billingAvailable":false},
  "rank":{"rating":1000,"games":0,"wins":0,"losses":0,"draws":0,"tier":"silver","provisional":true,"placementGames":5},
  "daily":{"claimed":false,"coins":50,"nextClaimAt":"2026-11-19T00:00:00.000Z"}
}
```

首次创建账户发 250 金币一次；每日按 UTC 领 50 一次。道具盾牌 20、清理 35、脉冲 25；单次买 1–10 个，库存上限 999。道具只用于娱乐模式，排位座位未退出时禁止消耗。消费与所得写入不可由客户端修改的流水；数据库 CHECK 防负余额。外观每项永久解锁一次，重复购买返回 `already_owned`。

共享商品定义在 `dist/platform/catalog.mjs`。免费提供深色/浅色主题和清晰方块，保证可读性不依赖消费。完整选项：

| 属性 | 允许值 |
|---|---|
| theme | obsidian、snow、aurora、sakura、cyber、ocean |
| blocks | classic、flat、bevel、neon、glass |
| board | grid、plain、stars |
| background | solid、aurora、dusk、snowfield、ocean |
| boardOverlay | 0.45–0.95；排位客户端可进一步提高最低对比度 |
| customTarget | background、board |
| locale | zh-Hant、zh-Hans、en、ja、ko |

## 好友

| 方法 / 路径 | 请求 / 结果 |
|---|---|
| GET `/v1/friends` | `{friends,requests,blocked}` |
| GET `/v1/friends/lookup?code=...` | 精确 12 位好友代码，回 `{friend:{id,nickname,friendCode}}` |
| POST `/v1/friends/requests` | `{friendCode}`，回 `{requestId,status,direction,friend}` |
| POST `/v1/friends/requests/:id/accept` | `{}`；仅接收者可接受 |
| POST `/v1/friends/requests/:id/decline` | `{}`；拒绝或撤销 |
| POST `/v1/friends/requests/:id/remove` | `{}`；删除好友关系 |
| POST `/v1/friends/block` | `{userId}`；封锁并删除关系 |
| DELETE `/v1/friends/block` | `{userId}`；解除封锁，不自动恢复好友 |

朋友/请求记录包含 `requestId,id,nickname,friendCode,direction,status,createdAt`。不会搜索或泄漏邮箱。已封锁关系双方不能通过好友代码查看对方，排位匹配也排除双方。客户端需要真实房间服务才能实现邀请朋友对战；当前好友系统并不等于已实现多人房间。

## 双人排位

POST `/v1/ranked/queue`，body `{}`，加入队列。GET 同路径每约两秒刷新等待心跳并尝试匹配；DELETE 同路径、body `{}` 离队。已有对局时返回该对局 ID，离队不会偷偷投降。

```json
{"status":"queued","queuedAt":"...","pollAfterMs":2000,"ratingWindow":250}
```

```json
{"status":"matched","matchId":"uuid"}
```

配对优先较早加入者，初始分差 250，随等待时间扩大，最多 1000。Postgres 事务级 advisory lock、队列行锁和每用户唯一 `sr_ranked_seats` 共同防止一个玩家被同时配进两局。

GET `/v1/matches/:id` 获取状态，POST `/v1/matches/:id/inputs` 提交：

```json
{"inputs":[{"seq":1,"action":"left"},{"seq":2,"action":"cw"},{"seq":3,"action":"hard"}]}
```

只允许 `left,right,soft,hard,cw,ccw,hold`。seq 正整数、在批内递增，重连以 `lastAcceptedSeq[you]+1` 继续；重复 seq 不再次执行。服务器指派下一 tick，客户端不得指定玩家、tick 或结果。每次读取/输入都在同一行锁交易内恢复私有检查点、按服务器时间推演、保存检查点、必要时完成唯一结算。刚配对有 3 秒倒计时，其间输入返回 `countdown_active`。

状态主要字段：`id,mode,status,you,players,startedAt,serverNow,countdownMs,tick,remainingMs,elapsedMs,games,incoming,totals,lastAcceptedSeq,lastAppliedSeq,result,settlement,rules,pollAfterMs`。`games[id]` 含 22×10 棋盘、`active`、`held`、`canHold`、5 个 `queue` 预览、`status`、`stats`、`ghost` 与 `cells`。公开快照不包含随机种子、私有 RNG、超过预览的包序列、历史或服务器输入日志。

GET `/v1/matches/history` 返回已登录玩家最近 30 局真实结算，格式 `{matches:[{id,opponent:{id,nickname},outcome,reason,elapsedMs,score,lines,spins,attack,ratingBefore,ratingAfter,coins,rewardReason,createdAt}]}`。该路由在 UUID 比赛路由之前匹配，不能查看其他用户历史。

输入响应另含 `inputResults:[{seq,ok,error?}]`。POST `/v1/matches/:id/forfeit` body `{}` 投降。`result` 含 `winnerId,kind,reason,tick,elapsedMs,netSent`；`settlement[id]` 含 `outcome,ratingBefore,ratingAfter,coins,rewardReason`。

初始 Elo 1000、K=32；完成 5 局后显示在 GET `/v1/leaderboard`。双方零放置或双方失联作废，不增局数。领奖要求至少 30 秒且双方各放 5 块；胜 30、平 20、负 10。每日最多 20 场奖励，同一对手每日最多 3 场。早退仍可扣分但不产币。流水与结算唯一键防止重放，客户端不能通过离线/CPU 成绩兑换金币。

## 支付适配器接口（当前未启用）

POST `/v1/webhooks/entitlement` 仅接收服务器适配器。该适配器必须先验证支付平台签名、订单金额、商品、收款主体与数据库中的买家映射，再发送标准事件。本接口本身不是 Stripe、Steam 或其他平台的原生 webhook，不得直接把客户端 JSON 转发并签名。

Header：`X-Snowrealm-Signature: t=<Unix秒>,v1=<HMAC-SHA256(secret,t+"."+原始JSON)>`，5 分钟有效窗口。

Body：`{eventId,userId,occurredAt,plan:"snowrealm_plus",status:"active"|"inactive"|"revoked",expiresAt}`。事件 ID 永久去重，同 ID 不同内容拒绝；旧事件不会覆盖更新事件；必须有已存在用户。退款/撤销也必须由适配器发送。secret 最少 32 字符，只保存服务器环境。未接真实平台和密钥时不可购买，不提供管理员网页开关。

## 验证、运维与发布限制

测试覆盖签名/issuer/过期、越权、外观与会员锁、重复购买/重复每日领取、并发消费不透支、好友接受权限与封锁、队列唯一座位、他人比赛不可读、一次排位结算、原始签名事件防篡改、输入字段白名单及快照隐私。PGlite 跑真实 PostgreSQL schema/事务，但它只有单后端连接，不能代替 Neon 多连接并发压测。

生产前继续做：两真实账户端到端登录/匹配、不同网络延迟/断网/恢复、同一玩家多标签页、支付沙箱与退款、真实数据库多连接竞态、内容审核和用户举报。当前防刷限制不能解决多账号串通、自动玩游戏或有组织排位操控；正式赛季需要检测、审查和申诉流程。

本版没有自动删除流水或对局的定时任务，避免误删财务记录。上线后应根据隐私政策配置对局输入日志保留期、数据库备份、错误告警、连接数/查询成本监控；用户数据删除需包含 Auth 与业务表的安全清理流程。禁止把生产服务账号共享给其他开发代理；协作通过版本库、接口契约和脱敏测试数据完成。

## 官方依据

- [Neon Functions authentication](https://neon.com/docs/compute/functions/authentication)：JWT issuer、JWKS 与客户端请求。
- [Deploy and manage Neon Functions](https://neon.com/docs/compute/functions/deploy)：Node.js 24、ESM bundle、CommonJS banner 与 ZIP 根入口。
- [Neon Functions environment variables](https://neon.com/docs/compute/functions/environment-variables)：运行时环境与注入凭据。
- [Neon Functions runtime limits](https://neon.com/docs/compute/functions/reference/runtime-limits)：服务容量边界。
