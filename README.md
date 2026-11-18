# SnowRealm Games / 旋界 SPINREALM — v0.4

网页版、PWA 与桌面发行共用的方块对战项目。SnowRealm Games 是账号与游戏馆；旋界是第一款可玩游戏。52 HUNT、NEXT FLOOR 目前是开发概念页。

## 这一版做了什么

- **游戏手感**：SRS 旋转补偿、T-Spin、7-bag、Hold、软降后可旋转、可调 DAS / ARR / 锁定、键位预设与自订、触控、标准映射手柄。
- **更大的棋盘**：对手与压力区在左侧，说明可收合；进行中隐藏会员工具列，让空间回到棋盘；可切换标准 / 大棋盘及全屏。
- **得分**：消行、T-Spin、B2B、Combo、全清与下落得分；显示本局得分与本机最佳。离线成绩不直接发云端金币。
- **金币**：可信 PostgreSQL 钱包与账本、首次 250、每日 50；合格排位胜 / 平 / 负奖励 30 / 20 / 10，防重复入账与并发透支。
- **商店**：六种主题、五种方块、独立棋盘样式、整页背景；预览 / 购买 / 装备；金币买派对道具券。
- **会员与好友**：Neon Managed Auth 邮箱密码、验证码验证、密码找回；唯一好友码、申请、接受、拒绝、移除、封锁。账户数据保存在服务器。
- **真人排位测试**：匹配队列、相同方块序列、权威服务器模拟、输入序列、防重复结算、Elo、前五场定位、排行榜与最近对局。没有 CPU 冒充真人。
- **五语界面**：繁体、简体、英语、日语、韩语；无需刷新即可切换。
- **声音**：一首背景音乐与十种操作音效，分开音量、手势启动、暂停/切后台停止。素材和授权见游戏的 `audio/LICENSES.txt`。
- **桌面候选版本**：Electron 沙箱、离线练习、本机资源服务、窗口/全屏与 Windows / Linux 构建流程。Steam SDK 功能尚未开启。

## 当前边界

订阅方案、权益校验、自订图片预览和按账户隔离的本机图片存储已经有实现；**没有商户配置，没有真实扣款，也没有假装购买成功的开通开关**。建议 US$4.99/月、US$39.99/年只是定价假设。图片目前不会上传云端；云端只同步外观设定。

排位是 HTTP polling beta，已有真实身份验证、服务器权威状态和结算。正式发行前仍须两名已验证会员在真实网络下进行完整对局、重连、好友与购买验收，并做延迟与并发压测。不要把已部署 API 说成已经完成大型实时竞技运营。

朋友房、多人混战、组队与合作仍在路线图。Steam App ID、正式商店、Windows 实机签名验收、Steam 成就/Cloud/Wallet 和 Steam Deck 验证尚未提供。Web/PWA 继续保留，不制作手机原生 App。

## 项目结构

| 路径 | 用途 |
|---|---|
| `dist/` | 可部署网页与 PWA |
| `dist/games/spinrealm/` | 游戏引擎、UI、声音、外观、会员/排位客户端与五语翻译 |
| `dist/platform/catalog.mjs` | 服务器共享的经济与商品规则 |
| `server/match-simulation.mjs` | 确定性模拟、输入验证、快照与结算规则 |
| `server/api/` | Node 24 / Neon Function API，PostgreSQL + JWT |
| `server/migrations/` | 应用表结构及 RLS |
| `desktop/` | 桌面外壳、隔离策略、安全测试、SteamPipe 范例 |
| `tests/` | 游戏、PWA、经济、模拟与客户端竞态测试 |
| `docs/` | 商业、协作、后端、部署与 Steam 简体教程 |
| `.github/workflows/` | 网页部署与桌面候选构建 |

## 本地开发与测试

需要 Node.js 24。前端已包含打包好的 Auth SDK，不需要从 CDN 下载运行时脚本。网站 `dist` 可以由一般静态服务器提供；认证、商城及排位需要网络。

```bash
npm ci --ignore-scripts
npm test
npm --prefix server/api ci --ignore-scripts
npm run test:api
npm run build:api
npm run build:pages
```

仅在升级 Auth SDK 时运行 `npm run build:auth`，并同步版本、锁文件和第三方授权。不要随意运行旧的 `scripts/build-pages.mjs` 覆盖已编辑的概念页。

桌面构建在 `desktop/` 运行；详见 [桌面开发说明](desktop/README.zh-CN.md)。CI 产物是测试候选，不会自动发布 Steam 或 GitHub Release。

```bash
npm --prefix desktop ci
npm run test:desktop
npm --prefix desktop run build:win
# Linux 主机
npm --prefix desktop run build:linux
```

## 部署与数据库

数据库采用独立的 **Neon PostgreSQL 17**，Singapore 区域，项目 SnowRealmGames-Cube1。会员由 Neon Managed Better Auth 管理，游戏 API 由 Neon Function 执行。浏览器不直接读写应用表，钱包/权益/结算只能经服务器处理。密码、数据库凭证和支付密钥不进入前端或 GitHub。

公开配置在 `dist/games/spinrealm/config.mjs`；`authUrl` 和 `apiUrl` 是允许公开的服务地址。开发或迁移时请替换成自己的项目，并登记精确的 CORS / Auth origins。后端迁移与部署见 [API 文档](docs/BACKEND_API_zh-CN.md)。

GitHub Pages 只能托管网页，不执行 `server/api`。Pages 路径 `/cube1/` 的构建见 [GitHub 部署说明](docs/GITHUB_DEPLOY_zh-CN.md)。新仓库通常需要在 Settings → Pages 选择 GitHub Actions，才能完成首次网页部署。

PWA 不缓存会员 API、JWT、支付通知或认证页面。修改预缓存资源后必须更新 `dist/sw.js` 的 VERSION，用户在游戏馆接受更新后才切换整个离线版本。

## 操作

| 动作 | 经典键盘 | WASD |
|---|---|---|
| 移动 | ← / → | A / D |
| 软降 | ↓ | S |
| 顺转 / 逆转 | X 或 ↑ / Z | W 或 ↑ / Q |
| 暂存交换 | C 或 Shift | E 或 Shift |
| 硬降并固定 | Space | Space |
| 暂停 | P | P |
| 练习撤销 | U | U |
| 免费能量道具 | 1 护盾 / 2 净化 / 3 震波 | 相同，已自订键位优先 |

标准手柄：方向键/左摇杆移动，A 顺转、X 逆转、Y 硬降、肩键 Hold、Start 暂停。真人排位不会因切后台或打开设置暂停服务器时间。排位统一 500 ms 锁定，个人键位、DAS 与 ARR 仍可调整。

## 文档

- [Steam 上架教程 PDF（简体，20 页）](docs/steam/SnowRealmGames_Steam_Guide_zh-CN.pdf)
- [Steam 教程 HTML（UTF-8，可直接打开）](docs/steam/SnowRealmGames_Steam_Guide_zh-CN.html)
- [Steam 教程 Markdown（UTF-8 BOM）](docs/steam/SnowRealmGames_Steam_Guide_zh-CN.md)
- [商业模式与金币经济](docs/BUSINESS_MODEL_zh-CN.md)
- [账号、好友、排位 API](docs/BACKEND_API_zh-CN.md)
- [两个实现的协作与比较](docs/COLLABORATION_zh-CN.md)

所有价格和转化率是待验证假设。旧 `/studio/` 的广告/新台币试算保留作历史规划；Steam 不采用广告变现，最新决定以 v0.4 商业文件为准。原始游戏、美术和音效没有使用旧 Battle 的素材；第三方组件与 CC0 音频按各自授权保留说明。
