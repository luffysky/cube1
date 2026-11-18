# SnowRealm Games / cube1：GitHub Pages 部署说明

核对日期：2026-11-18。本文使用简体中文，文件编码为 UTF-8。

## 1. 本次交付的内容

仓库的 `dist/` 是现有网站源码与静态资源。新增的 `scripts/build-github-pages.mjs` 会把它复制成 `release-web/`，为 GitHub 项目站点加入 `/cube1/` 路径前缀，并验证页面、模块、图标、音频和 PWA 路由。原始 `dist/` 不会被改写。

网站预期入口是：

- 平台：`https://luffysky.github.io/cube1/`
- 旋界：`https://luffysky.github.io/cube1/games/spinrealm/`
- 开发工作台：`https://luffysky.github.io/cube1/studio/`

这些是预期地址；必须等 GitHub Actions 的部署步骤成功后，才能确认已经上线。GitHub 仓库、GitHub Pages 静态网站与 Neon 后端是三个不同的部分。上传代码不等于启用了 Pages，也不等于完成了后台服务配置。

## 2. 首次开启 Pages

1. 在 GitHub 打开 `luffysky/cube1`。
2. 进入 **Settings → Pages**。
3. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
4. 确认仓库允许运行 `.github/workflows/pages.yml` 使用的官方 Actions。
5. 推送到 `main`，或者进入 **Actions → GitHub Pages → Run workflow**，选择 `main`。
6. 等待 `build` 和 `deploy` 两个任务成功。部署任务会显示实际网址。

GitHub 官方明确要求自定义发布流程使用 Pages Actions 发布源；`github-pages` environment 用于部署保护与显示网站地址。[来源：配置发布源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)、[来源：自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

工作流不要求你创建个人访问令牌，也不包含 Neon、数据库或支付密钥。`configure-pages` 虽然提供 `enablement` 参数，但官方说明初次自动启用需要 **非默认 `GITHUB_TOKEN`**，并且需要额外权限。因此这里保留明确的一次性 Pages 设置步骤，不使用一个看似自动、实际权限不足的 `enablement: true`。[来源：configure-pages 参数定义](https://github.com/actions/configure-pages/blob/v6.0.0/action.yml)。

## 3. 工作流会做什么

每次推送 `main`、对 `main` 发起 pull request，或者手动运行时，工作流都会执行游戏与离线规则测试，并构建静态网站。Pull request 只验证和上传构建产物，不会部署到正式站点。只有 `main` 的推送或手动运行能够进入部署任务。

| 步骤 | 本仓库使用的版本 | 用途 |
| --- | --- | --- |
| `actions/checkout` | `v7.0.1` | 取出本次提交 |
| `actions/setup-node` | `v7.1.0` | 使用 Node.js 24 |
| `actions/configure-pages` | `v6.0.0` | 读取 Pages 的路径配置 |
| `actions/upload-pages-artifact` | `v5.0.0` | 上传 `release-web/` |
| `actions/deploy-pages` | `v5.0.1` | 发布网站并返回网址 |

上述版本按核对日的官方 release 页面选择。GitHub 文档中的示例可能仍展示较早的大版本；更新时应同时核对 release notes，而不只替换数字。[checkout](https://github.com/actions/checkout/releases)、[setup-node](https://github.com/actions/setup-node/releases)、[configure-pages](https://github.com/actions/configure-pages/releases)、[upload-pages-artifact](https://github.com/actions/upload-pages-artifact/releases)、[deploy-pages](https://github.com/actions/deploy-pages/releases)。

构建任务只需要读取代码和 Pages 配置。部署任务明确声明 `pages: write` 与 `id-token: write`，并依赖构建完成；这对应 GitHub 官方自定义 Pages 部署要求。[来源：部署权限与任务关系](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 4. 本地构建与路径检查

在仓库根目录使用 Node.js 24：

```bash
npm test
node scripts/build-github-pages.mjs --self-test
node scripts/build-github-pages.mjs --base=/cube1/
node scripts/build-github-pages.mjs --base=/cube1/ --check
```

脚本会输出文件数量、静态引用数量、离线缓存资源数量和资源指纹。`release-web/` 只包含前端文件；Node API、SQL 和开发密钥不会被复制进去。

如要在本地模拟项目站点路径，请把 `release-web/` 放在一个临时父目录的 `cube1/` 子目录，再从父目录启动静态服务器，访问 `/cube1/`。直接把 `release-web/` 作为服务器根目录打开 `/`，与 GitHub 项目站点的路径布局不同，不能作为路径验收结果。

自定义域名使用根路径时可运行：

```bash
node scripts/build-github-pages.mjs --base=/
```

正式工作流会从 `configure-pages` 的 `base_path` 输出获取路径，所以切换到自定义域名后不必在网页源码中全局替换 `/cube1/`。

### 构建时已检查的风险

- HTML、CSS 和 ES module 引用必须指向实际存在的前端文件。
- 只重写已知本地站点路径，例如 `/assets/`、`/games/`、`/studio/`、平台入口与 PWA 文件。
- `/v1/*`、`/api/*`、外部 HTTPS 地址和认证 SDK 不会被改写；脚本还比较变换前后的 API 与外部地址字面量。
- Manifest 的 `id`、`scope`、`start_url` 与图标路径必须匹配项目目录。
- Service Worker 的平台注册页、旋界目录页与 `index.html` 别名都要正确；API、认证回调查询参数、开发工作台与外部地址不能进入离线兜底。
- PWA 注册 URL 和 scope 必须为项目路径；缓存命名包含路径摘要，避免误清同一域名下其他项目的缓存。
- 每次资源变动产生新的构建指纹，使离线壳版本随资源一起更新。
- 构建产物拒绝符号链接，只复制 `dist/`，隐藏源文件不会进入产物。

## 5. 登录、金币和排位为什么还需要 Neon

GitHub Pages 用来交付静态前端。运行中的 API 和数据存储仍由 Neon 承担。本项目的前端从 `dist/games/spinrealm/config.mjs` 读取公开的 Auth URL 与 API URL；这里的 URL 不是服务端秘密。

发布到 GitHub Pages 后，后台必须允许新的浏览器来源：

```text
https://luffysky.github.io
```

浏览器的 origin 由协议、域名和端口组成，**不包含 `/cube1/` 路径**。应在 Neon Auth 的可信来源及 API CORS 配置中加入正确 origin；需要回调 URL 的设置则使用完整实际回调路径。不要为了排错把认证或 CORS 放宽成任意来源。

数据库连接串、Neon API 密钥、支付密钥、Webhook 密钥只能放在服务端配置。`release-web/` 中所有内容都按公开文件处理。后台部署、数据库迁移与 API 说明另见 [BACKEND_API_zh-CN.md](./BACKEND_API_zh-CN.md)。

首次验收至少应分别确认：访客本机对局、五种语言切换、会员登录、每日金币只入账一次、商品购买不重复扣币、不同账号好友关系隔离、两位真人排位、离线本机练习。页面能打开，只证明静态托管可用。

## 6. 更新与回滚

日常修改先完成测试，再推送 `main`。工作流会重新构建和发布。PWA 会先下载并验证完整资源；玩家在游戏结束后回平台接受更新，不应在对局中强制替换代码。

如果发布后出现问题，优先用 Git revert 撤销问题提交，再推送一个新提交触发重新部署。不要通过删除数据库或改写用户余额回滚前端。已安装 PWA 的玩家可能暂时保留旧版，应该把页面、模块和离线缓存版本当成一组检查。

## 7. 常见问题

| 现象 | 排查顺序 |
| --- | --- |
| `configure-pages` 报找不到 Pages | 检查 Settings → Pages 是否已选择 GitHub Actions，再重跑工作流 |
| 构建成功但没有网址 | 检查 `deploy` 是否运行；PR 和非 `main` 手动构建不会发布 |
| CSS、图标或模块 404 | 确认发布的是 `release-web/`，且 `base_path` 对应 `/cube1` |
| 登录被拒绝 | 检查 Auth 可信来源、API CORS、前端公开 URL；不要把数据库密码填到前端 |
| 商城和排位断线，但单机正常 | 分别检查 Neon API 健康状态与认证令牌，Pages 不负责运行 API |
| 新版本上线后仍看到旧版 | 检查 PWA 更新提示，结束对局后回平台更新；开发时可在浏览器 Application 面板查看 Service Worker |
| `--check` 报未加前缀路径 | 检查新代码是否添加了新的站点根路径；在构建器中明确加入已知路径并扩展验证，不要全局替换所有 `/` |

## 8. 本文的边界

这套工作流部署浏览器版与 PWA，不负责 Steam 提交，也不启用付款。桌面包装构建由独立的 desktop workflow 处理。Plus 页面展示的是规划方案，正式上线订阅仍需接入支付、服务端回调、退款与权益撤销。
