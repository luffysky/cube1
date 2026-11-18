# 旋界桌面发行候选壳 / SnowRealm Games

这是与浏览器版共用游戏资源的 Electron 桌面工程。它把仓库的 `dist/` 打进发行包，使用仅绑定本机的 `http://127.0.0.1:43671` 提供资源，并默认打开《旋界》的自由练习入口。

网站 / PWA 继续保留。这个目录增加的是桌面发行层，没有另外复制一套游戏规则，也没有把未实现的 Steam 功能标成可用。

## 1. 已实现与未实现的边界

| 能力 | 本工程状态 |
| --- | --- |
| 打包现有网页游戏 | 已配置：`../dist` → `resources/web`；入口 `games/spinrealm/index.html` |
| 离线练习入口 | 桌面 bootstrap 载入后选择现有的自由练习按钮；全部游戏资源随包提供 |
| 窗口与全屏 | F11 切换，Esc 退出全屏；菜单可返回练习和平台首页 |
| 本地设置 | 使用独立、持久的 Electron 用户数据；不与普通浏览器自动共享 |
| 资源服务器安全 | 路径、Host、Origin、软链接、MIME 和音频 Range 有自动化测试 |
| Neon 托管认证 | 已配置公开认证 origin，服务端启用 `allow_localhost`，前端 SDK 随本地资源打包；真实会员登录和桌面 GUI 尚未实测 |
| 在线 API | 已配置真实 HTTPS 服务，`onlineApi` 已开启；服务及数据库就绪检查已返回 200，桌面端完整业务流程仍待验收 |
| Steam SDK / Cloud / 成就 / Steam 好友 / Wallet | **均未接入且默认关闭**；设置一个 App ID 不会自动实现这些功能 |
| Windows 签名、Steam Overlay、Deck 认证 | 未完成；不能据此宣称正式发行或已通过 Steam 审核 |

自动化测试不启动 Electron 或浏览器，也不代表已经完成 Windows / Linux 的交互、性能、音频、登录和控制器实机验收。

## 2. 开发环境与精确版本

使用 **Node.js 24.x**。本次命令验证环境为 Node.js `24.22.3`。直接开发依赖使用精确版本，传递依赖由 `package-lock.json` 锁定：

| 包 | 固定版本 | 核查日期 |
| --- | --- | --- |
| `electron` | `45.3.4` | 2026-11-18，npm 官方 registry |
| `electron-builder` | `26.18.0` | 2026-11-18，npm 官方 registry |

不要用 `npm update` 代替可复现安装。升级 Electron 后重新验证安全配置、打包和真实设备行为，及时接收 Chromium / Electron 安全修复。

在仓库根目录执行：

```sh
cd desktop
npm ci
npm test
npm run verify:assets
npm start
```

`npm ci` 会下载构建工具和对应 Electron 二进制，需要网络；游戏资源在 `dist/` 完整时，本地练习本身不需要下载网页。请在有图形桌面的普通用户会话中运行 `npm start`。

### 开发目录关系

```text
dist/                         现有游戏与平台的公开文件
desktop/
  main.cjs                    窗口、生命周期、受限导航与 IPC
  preload.cjs                 三个明确命名的桌面 API
  desktop.config.json         仅公开的环境 / 功能配置
  lib/local-server.cjs        本机只读静态资源服务器
  lib/policy.cjs              配置、CSP、导航与网络白名单
  renderer/bootstrap.mjs      桌面专用练习入口初始化
  scripts/verify-assets.cjs   资源检查与哈希清单生成
  test/                       Node 内建测试，无 GUI
  steam/                      无真实 App ID 的 SteamPipe 示例
  release/                    构建产物，不提交 Git
```

资源检查要求游戏入口、核心模块、样式与图标存在；拒绝软链接、隐藏文件、密钥 / 数据库类文件名和未支持的类型。生成的 `build-info.json` 记录公开文件的路径、大小与 SHA-256，方便核对发行包来源。文件名检查是防止误打包的一道防线，不能替代提交前的秘密扫描；`dist/` 中所有内容都必须本来就可公开。

## 3. 配置认证和 API

编辑本目录的 `desktop.config.json`，不要写私钥、数据库连接串、管理员令牌、Steam Web API key 或支付 secret。

```json
{
  "authOrigin": "https://ep-crimson-truth-b3j5tyvk.neonauth.c-4.ap-southeast-1.aws.neon.tech",
  "apiBaseUrl": "https://br-winter-thunder-b3ozovl2-cube1api.compute.c-4.ap-southeast-1.aws.neon.tech",
  "steamAppId": null,
  "features": {
    "onlineApi": true,
    "steamSdk": false,
    "steamCloud": false,
    "steamAchievements": false,
    "steamFriends": false,
    "steamWallet": false
  }
}
```

固定本机 origin 为 `http://127.0.0.1:43671`。API 服务已精确允许这个 CORS origin，Neon Auth 已开启 `allow_localhost`；服务和数据库就绪检查已经返回 200。这些配置不等于真实会员登录、会话恢复和桌面 GUI 已通过端到端验收。这里没有关闭 TLS 验证、放开所有 CORS 或绕过认证提供商限制。

只支持公开的 HTTPS 认证 / API 地址。认证 origin 不接受路径、查询、片段或账号密码。当前配置已允许上述 API origin 的 XHR，以及相同 host 的 WSS；这是桌面网络白名单能力，不表示后端已经实现所有 WebSocket、排行或支付功能。账户授权、好友、经济账本与业务错误仍需逐项验收。

认证客户端已作为本地 SDK 打包进 `dist/`。默认 CSP 不允许从 CDN 动态载入远程 JavaScript，也不允许 iframe 登录或远程网页接管游戏窗口。若改用 OAuth 弹窗 / 跳转，须单独设计可验证的回调协议和导航白名单，不能直接把安全设置全部关闭。

### 共用前端可用的桌面 API

```js
if (window.snowrealmDesktop?.isDesktop) {
  const info = await window.snowrealmDesktop.getRuntimeInfo();
  // info: runtime, version, defaultMode, authOrigin, apiBaseUrl,
  //       steamAppId, features
  await window.snowrealmDesktop.toggleFullscreen();
  await window.snowrealmDesktop.exitFullscreen();
}
```

同源 `GET /__desktop__/config.json` 返回相同的公开配置。bootstrap 完成后还发出 `snowrealm:desktop-ready` 自定义事件；需要可靠读取时直接调用 `getRuntimeInfo()`，避免事件已经发生而错过通知。

桥接没有任意文件读写、任意 URL 打开、任意 IPC 通道、命令执行或 Steam 密钥访问。主进程只接受本窗口主 frame 发起的调用。改变网页对象或本地存档不会解锁 Steam 能力。

## 4. 安全边界和运行行为

- 开启 Electron process sandbox、`contextIsolation` 和 `webSecurity`；关闭 `nodeIntegration`、worker / 子 frame Node、`webviewTag`、拖拽导航和非开发版本 DevTools。
- 只绑定 `127.0.0.1:43671`，没有 LAN 监听。端口被其他进程占用时，报错并退出；不会连接或信任现有服务，也不会偷偷换一个端口。
- 单实例运行。重复启动会聚焦现有窗口。
- 静态服务器仅处理 GET / HEAD；验证 Host / Origin，拒绝路径穿越、重复编码、反斜线、NUL、NTFS 替代数据流和跳出资源目录的软链接。
- 只返回明确支持的 MIME。没有目录列表，不会提供 `.env`、source map、数据库或任意系统路径。单个资源最大为 64 MiB；需要更大资源时应明确调整并测试。
- CSP 允许本地模块，不允许 eval / 内联脚本、对象或 frame。现有游戏通过 style 元素 / 属性调整外观，因此样式保留 `unsafe-inline`；这不允许内联 JavaScript。
- 图片可使用本地 data / blob，音频支持字节范围请求。新窗口默认拒绝；同源链接在当前窗口打开，官方 HTTPS 链接按精确 host 和路径白名单交给系统浏览器。
- 外链白名单仅包括本项目 GitHub 仓库、Steamworks 文档、Steam 退款页和 Steam 支持站点；没有通配的任意域名规则。
- 仅允许当前聚焦窗口的可信主页面写入剪贴板（用于复制好友码）和请求全屏；剪贴板读取、自动全屏、相机、麦克风、定位等其他权限与自动下载仍拒绝。没有增加任意剪贴板 IPC。
- 桌面资源随安装包更新；启动清除 service worker 与 Cache Storage，保留本地设置 / localStorage。服务器不提供 `/sw.js`，CSP 也不允许 worker，避免旧 PWA 缓存覆盖新安装包。

端口上的文件均是公开游戏资产。本机 HTTP 不是秘密保管库；不要将任何客户端密钥或可信余额逻辑放进去。可信金币、段位、好友权限、订阅与订单仍由后端验证。

## 5. 构建 Windows ZIP / NSIS

在 Windows 的仓库 `desktop/` 目录执行：

```powershell
npm ci
npm test
npm run build:win
```

产物位于 `desktop/release/`：

- `Spinrealm-<version>-win-x64.zip`：解压后运行 `spinrealm.exe`。
- `Spinrealm-<version>-win-x64.exe`：NSIS 用户级安装程序，可选择安装目录。
- `win-unpacked/`：完整未压缩应用，用于核对资源和准备 Steam depot。

ZIP 是免安装分发，不等于把全部存档放在 ZIP 旁边。设置 / 本地记录保存在 Electron 的用户数据目录，移动解压文件夹不会自动搬迁账号会话或存档。NSIS 配置默认保留卸载前的用户数据。

本工程没有 Windows 代码签名证书或签名 secret。未签名候选包可能显示系统提示；正式发行应根据发行渠道安排可信签名并验收。不能把 CI 构建成功当作已通过 Microsoft 或 Steam 审核。

## 6. 构建 Linux AppImage

在 Linux 的 `desktop/` 目录执行：

```sh
npm ci
npm test
npm run build:linux
```

产物为 `release/Spinrealm-<version>-linux-x86_64.AppImage`。AppImage 使用 `x86_64` 架构标记；这是本次构建实际生成的文件名。在有图形会话的目标机器赋予执行权限后运行，例如：

```sh
chmod +x release/Spinrealm-0.4.0-preview.1-linux-x86_64.AppImage
./release/Spinrealm-0.4.0-preview.1-linux-x86_64.AppImage
```

若仅检查当前系统的打包目录，可以执行 `npm run build:dir`。AppImage 的 FUSE / 沙箱环境要求需按目标发行版检查；不要用 `--no-sandbox` 绕过错误后就宣布支持 Linux。

本轮没有启动 Electron 做视觉验收。Linux AppImage、Windows 窗口、音频、输入延迟、触控 / 手柄、休眠恢复和真实认证流程仍需在目标机器逐项运行。暂未提供 macOS 打包 / 签名 / 公证配置。

## 7. GitHub Actions 产物

工作流位于仓库 `.github/workflows/desktop-build.yml`。支持手动运行，以及 `main` 上 desktop / dist 相关提交和 PR。

工作流分别在 Windows 和 Linux 构建，使用 Node 24 和 `npm ci`，执行安全测试后生成 ZIP / NSIS / AppImage，并上传 Actions artifact。三个官方 Actions 以核查当日的 v7 commit SHA 固定，仓库权限仅 `contents: read`。

Windows 流程还检查 `win-unpacked/resources/web/games/spinrealm/index.html`，并生成候选包 SHA-256 记录。artifact 包含 `build-info.json` 和本说明，不包含秘密配置。保留期设为 14 天；长期分发需另行安排正式 release。

此 workflow 不发布 GitHub Release、不上传 Steam、不部署网站，也不需要 Steam、数据库、支付或签名密钥。`--publish never` 明确禁止 electron-builder 自动发布。

## 8. SteamPipe 准备方式

先完成 Steamworks 入驻、取得自己的 App ID / Windows depot ID，并按完整 Steam 教程完成商店与构建审核。不要复制他人的编号，也不要把测试用 App ID 当作本游戏正式编号。

1. 完成 Windows 构建及实机验收。
2. 将 `release/win-unpacked/` 的**全部内容**复制到 SDK `tools/ContentBuilder/content/spinrealm/`。不能只复制一个 exe；`resources/web` 和 Electron 运行文件都需要。
3. 在 `tools/ContentBuilder/scripts/` 复制本目录 `steam/app_build.vdf.example` 与 `steam/depot_windows.vdf.example`，分别去掉 `.example`。
4. 把 `YOUR_APP_ID` 和 `YOUR_WINDOWS_DEPOT_ID` 替换为后台分配给你的编号。示例故意不含 `SetLive`，不会上传时自动切公开分支。
5. 在 Steamworks 配置 Windows 启动文件 `spinrealm.exe`，使用官方 SteamPipe / SteamCMD 流程上传到测试分支。
6. 从 Steam 客户端真实下载安装，验证完整游戏，而不是只测试本地构建文件夹。

NSIS 安装器是站外候选包分发用途。Steam depot 应上传完整可运行目录，由 Steam 管理安装，不要把整个游戏变成“先运行另一个安装器”。

`desktop.config.json` 的 `steamAppId` 仅预留公开配置位置。当前程序不会初始化 SDK，不会校验 Steam 身份，不会自动获得成就、Cloud、Steam 好友或 Wallet。把这些 gate 改成 `true` 会直接失败，直到对应实现与验证真正加入。

## 9. 正式发行前剩余验收

工程验证记录（2026-11-18）：已完成 `npm ci`、19 项桌面安全测试、公开资源检查、Linux x64 解包构建和最终 AppImage 构建。最终产物包含最新前端、预测模块、真实 API 配置、SDK 第三方许可证和音频授权说明；71 个随包公开文件已逐一核对大小及 SHA-256，ASAR 中的公开配置与构建清单也已核对。安全测试覆盖 API 精确 origin 白名单、关闭开关后的拒绝行为，以及好友码复制 / 全屏所需的可信主页面权限。校验记录保存在 `release/build-verification.json` 与 `release/SHA256SUMS.txt`。没有启动 Electron / 浏览器，没有运行 Windows 候选包，也没有触发远程 GitHub Actions。真实会员登录和下面的实机验收仍需完成。

| 项目 | 完成证据 |
| --- | --- |
| 桌面启动 / 断网 | 从候选包安装后，断网可进入并完成自由练习、电脑对战和已有教程 |
| 键盘与窗口 | F11 / Esc、切换输入法、失焦、缩放、低分辨率、返回菜单正常 |
| 游戏画面和音频 | 所有主题 / 自定义图片可读；音量 / 静音正常；无重复播放或输入延迟回退 |
| 托管认证 | 固定 localhost 来源获允许；真实注册 / 登录 / 退出 / 会话过期通过 |
| API 和经济 | 真实 API 已配置；验证完整业务流程，金币 / 排位 / 好友 / 订阅不信任本机数据 |
| Steam 功能 | 取得正式 App ID 后单独接 SDK、票据、Wallet、退款、成就 / Cloud / 好友 |
| 原始素材与许可证 | 所有打包音频 / 字体 / 图像及依赖的分发权和署名完整 |
| 发行操作 | 签名策略、SteamPipe、商店 / 问卷、审核和回滚流程真实完成 |

不要将候选壳叫作“已能过 Steam 审核”或“Steam 版已发行”。当前正确名称是 **桌面发行候选工程**。

## 10. 官方参考

下列资料核查于 **2026-11-18**；首次正式发行与依赖升级时复核：

- Electron npm registry：https://registry.npmjs.org/electron/latest
- electron-builder npm registry：https://registry.npmjs.org/electron-builder/latest
- Electron 安全建议：https://www.electronjs.org/docs/latest/tutorial/security/
- Electron sandbox：https://www.electronjs.org/docs/latest/tutorial/sandbox/
- Electron context isolation：https://www.electronjs.org/docs/latest/tutorial/context-isolation/
- electron-builder v26 配置：https://www.electron.build/v26/docs/configuration/
- electron-builder 内容打包：https://www.electron.build/v26/docs/contents/
- 官方 GitHub Actions：https://github.com/actions/checkout 、https://github.com/actions/setup-node 、https://github.com/actions/upload-artifact
- SteamPipe：https://partner.steamgames.com/doc/sdk/uploading
- Steam 审核：https://partner.steamgames.com/doc/store/review_process
- Steam 身份：https://partner.steamgames.com/doc/features/auth
- Steam 内购：https://partner.steamgames.com/doc/features/microtransactions

更完整的费用、等待期、商店素材、分级、AI 披露、订阅、退款、UGC 和多语言说明，见项目另附的《SnowRealm Games / 旋界 Steam 上架教程与注意事项》简体中文版。
