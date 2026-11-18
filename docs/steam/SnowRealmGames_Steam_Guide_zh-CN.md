# SnowRealm Games / 旋界

# Steam 上架教程与注意事项

版本 1.0 · 简体中文 · 核查日 2026-11-18

## 从网页游戏，走到可交付的 Steam 产品

发布手册 · 简体中文版 · 2026-11-18 核查

适用项目：SnowRealm Games 游戏平台与《旋界》。覆盖浏览器 / PWA、电脑对战、线上房间、好友、排位、金币、道具、外观商城、订阅和自定义图片。未来的「52」与「电梯」应各自评估产品身份、权利和发行范围。

> **先明确交付边界**
>
> 这份文件是可执行的上架路线与审核清单，不代表 Steam 已接收、审核或批准游戏。GitHub 源码、网站上线和 Steam 正式发行是三个不同的交付结果。

### 建议采用的首发路线

- 继续把浏览器版作为主开发入口，共用游戏规则、五语文案和服务端；另做包含本地资源的 Windows 桌面发行包。
- 先完成可独立运行的练习 / 电脑对战，再将实际通过验证的联机、排位和付费功能加入 Steam 商店承诺。
- Steam 首发采用免费游玩 + 直接购买外观的设计；金币主要通过对局获得，道具限定在明确标识的派对模式。具体付费方案仍须完成平台审核。
- 订阅、跨平台权益共享、公开图片分享和两款相近产品同时发行，先确认平台条件与运营能力，再开放收费。

### 阅读标记

| 标记 | 含义 |
| --- | --- |
| 必须 | 官方公开文档的明确要求，或发布前必须完成的事实核对；引用 [Sxx] 可在文末找到官网。 |
| 建议 | 针对本项目的产品、工程和运营判断，不冒充 Steam 的硬性规定。 |
| 待核实 | 公开资料无法判定个案；由发行主体在 Steamworks 支持渠道确认，并保留答复。 |

所有政策和数字的核查日均为 2026-11-18。实际操作前应重新打开对应官方链接，以当时的 Steamworks 后台、签署协议和审核反馈为准。文件没有假定你已支付费用、提供银行税务资料或完成任何实名手续。

格式说明：HTML 可直接用浏览器打开；PDF 适合阅读和转发；Markdown 采用 UTF-8 BOM，以降低旧编辑器识别中文编码出错的概率。


## 01 / 费用、身份与时间：先把硬条件算清楚

必须 · 官方金额与时间单独列示

| 事项 | 当前规则 / 口径 | 来源 |
| --- | --- | --- |
| 每个新应用的提交费 | USD 100 或等值当地货币；费用不退。达到至少 USD 1,000 调整后总收入后，可在后续付款中回收。不是缴费后立即退款。 | S01 |
| 首次几款产品的等待期 | 支付该应用费用后，发行前至少等待 21 天。不要继续套用旧教程常见的 30 天版本。 | S02 / S03 |
| Coming Soon | 商店「即将推出」页面须公开至少两周，才能正式发行。 | S02 |
| 税务资料验证 | 可能最长达 30 天，也可能要求补充文件；与 21 天发行等待期属于不同事项。 | S02 |
| 商店页面审核 | 通常 3-5 个工作日；官方建议至少提前 7 个工作日提交，留出修改空间。 | S04 |
| 游戏构建审核 | 通常 3-5 个工作日；至少预留 7 个工作日。并非上传完成即通过。 | S04 |

核查日：2026-11-18。等待期以当前官网正文为依据；搜索快照、旧文章及旧版本文件可能仍显示不同数字。费用可能涉及当地税费，支付时确认最终金额。[S01](https://partner.steamgames.com/doc/gettingstarted/appfee)[S02](https://partner.steamgames.com/doc/gettingstarted/onboarding)

### 注册主体和收款资料

必须使用真实法律主体名称；银行账户户名须与入驻主体匹配。可以个人身份入驻，但不能把尚未注册的 SnowRealm Games 品牌名称当作法律姓名或公司名称。注册主体需要拥有发布产品的权利，并签署相应 NDA 和 Steam Distribution Agreement。[S02](https://partner.steamgames.com/doc/gettingstarted/onboarding)

### 税务和收入不要混为一个百分比

税务问卷会根据身份和居住地生成预扣税结果。Steam 公布的美国来源收入预扣区间为 0%-30%；该数字不是整个平台的分成比例，也不能直接当作你最终的税率。不要假定台湾、其他地区或个人 / 公司身份适用相同规则。[S27](https://partner.steamgames.com/doc/finance/taxfaq)

> **建议 · 预算口径**
>
> 用「玩家实际付款 - 退款 / 拒付 - 适用税费 - 合约分成 - 服务器 / 支付运营 / 客服 / 素材成本」建立现金流模型。分成和结算条件以自己签署的协议为准，不能仅凭“大家都说抽三成”做财务承诺。


## 02 / 实际上架顺序与倒排计划

建议流程 · 每个闸门都应有可查看证据

| 步骤 | 具体动作 | 完成证据 |
| --- | --- | --- |
| 1. 主体准备 | 确定个人或公司；整理法律姓名、地址、银行和税务资料。 | 负责人确认，资料与收款主体一致。 |
| 2. Steamworks 入驻 | 通过官方入口完成协议、应用费用、银行 / 税务 / 身份流程。 | 后台状态通过；保存发票和应用编号。 |
| 3. 商店准备 | 填商品信息、语言、系统需求、内容问卷与素材；说明在线账户要求。 | 可预览的商店页面，内容符合实际版本。 |
| 4. 页面审核与公开 | 提交商店审核；通过后发布 Coming Soon。 | 公开页面网址及公开时间。 |
| 5. 封装与接入 | 建立桌面包、Steam 身份、存档、支付适配和实际联机后端。 | 全新电脑可装可玩，接口验收记录。 |
| 6. 测试与构建审核 | 上传测试分支、安装验收、修复问题；提交接近最终版本。 | 通过构建审核，锁定首发 Build ID。 |
| 7. 正式发布 | 满足所有等待期；确认默认分支、价格 / 免费属性和服务器。 | 授权负责人按 Release App，检查公开结果。 |

商店和构建是不同审核对象；发行由具备权限的账户通过后台发布控件执行。上传到 SteamPipe、选中某个构建、通过审核，都不等同于已经正式发行。[S04](https://partner.steamgames.com/doc/store/review_process)[S19](https://partner.steamgames.com/doc/store/releasing)

### 如何计算最早发行日

以「支付费用 + 21 天」「Coming Soon 公开 + 两周」「身份与税务审核完成」「商店及构建通过」「真实服务可用」中最晚的时间为下限，再留出修复缓冲。几个等待条件可以重叠，但不能简单说交钱后第 21 天一定能上线。[S02](https://partner.steamgames.com/doc/gettingstarted/onboarding)[S04](https://partner.steamgames.com/doc/store/review_process)

### 测试阶段的选择

建议先用 Steam Playtest 收集输入手感、匹配和联机反馈。Playtest 对开发者和玩家免费，不能卖测试资格、售卖 Playtest key，或把资格塞进付费订阅包。[S24](https://partner.steamgames.com/doc/features/playtest)

Early Access 是销售当前可玩的未完成产品，当前版本本身必须值得其售价；它不是只卖未来承诺的众筹工具。若后端、核心对局或商业功能仍不稳定，应继续免费测试，而不是把“抢先体验”当作免检标签。[S30](https://partner.steamgames.com/doc/store/earlyaccess)


## 03 / 网页技术如何进入 Steam

建议 · 共用游戏核心，增加桌面发行层

浏览器 / PWA 继续保留。Steam 版需要向 Steam 提供能够安装和启动的产品构建，并在商店声明的操作系统上正常运行。仅给出一个网站网址或 GitHub 仓库，不能替代完整发行构建。[S04](https://partner.steamgames.com/doc/store/review_process)[S08](https://partner.steamgames.com/doc/sdk/uploading)

| 层 | 本项目建议 | 首发验收 |
| --- | --- | --- |
| 共享规则核心 | 方块生成、旋转、Hold、计分和回放逻辑独立于网页界面。 | 相同种子、规则版本和输入能复现结果。 |
| 浏览器版本 | 保留链接直玩、PWA 安装和响应式界面。 | 桌面与触控可操作；浏览器刷新不损坏持久数据。 |
| 桌面容器 | 评估 Electron 或 Tauri 等方案；把游戏 HTML / JS / 图片 / 音频打入本地包。 | 断网可进入已声明的单机内容；无空白网页或浏览器外跳依赖。 |
| Steam 适配层 | 封装 Steam 身份、语言、好友邀请、成就、支付等能力。 | 不把 SDK 密钥或管理功能暴露给网页脚本。 |
| SnowRealm 服务端 | 统一账户、好友、匹配、对局验证、金币账本和权益。 | 服务端验证身份；可以处理重试、退款、断线和回滚。 |

### 关于 Steamworks SDK 的准确说法

Steam 官方说明：发行游戏本身不强制集成所有 Steamworks API；但使用微交易、成就、Steam 身份等特定功能，需要按对应接口完成集成。SteamPipe 上传工具与游戏内 API 接入也不是同一件事。[S32](https://partner.steamgames.com/doc/sdk/api)[S08](https://partner.steamgames.com/doc/sdk/uploading)[S25](https://partner.steamgames.com/doc/features/microtransactions/implementation)

### 桌面封装的工程注意事项

- 锁定发布依赖和打包版本；保留构建来源、Git commit 与校验值。不要在发行包里附带 .env、私钥、数据库密码或开发账户。
- 本地游戏资源优先。远程内容更新应有版本兼容和回滚设计；不要让网页一次部署就悄悄破坏已审核桌面版本。
- 桌面壳只暴露必要能力。自定义图片不能执行脚本，不能任意访问系统路径；外部链接限制用途和目标。
- Windows 首发先做实机验证；macOS / Linux 后续各自提供可测试构建，验证之前不要在商店勾选支持。

> **待核实**
>
> 桌面桥接库的维护状况、许可证、架构支持及 Steam Overlay 行为，需要按最终选型做小型验证；“能把网页装进窗口”不等于 Steam 支付、手柄和 Overlay 已经兼容。


## 04 / SteamPipe 上传：从文件到可安装构建

操作教程 · 以下占位符必须换成你的后台编号

- 在 Steamworks 取得 App ID，配置对应平台的 depot、启动文件和启动选项。
- 下载官方 SDK，使用 tools/ContentBuilder；将成品桌面文件放入 content 下的项目目录。
- 建立仅具备必要权限的构建账户。官方建议构建账户拥有 Edit App Metadata 与 Publish App Changes To Steam 等所需权限，不复用个人最高权限账户。[S08](https://partner.steamgames.com/doc/sdk/uploading)
- 编写 app 和 depot VDF；先上传私人测试分支，使用测试账户从 Steam 客户端实际下载安装。
- 确认文件、语言、运行库、存档、Overlay 和退出行为后，再选定要提交审核的构建。

### 最小 VDF 结构示例

```text
"AppBuild"
{
  "AppID" "YOUR_APP_ID"
  "Desc" "spinrealm-review-candidate"
  "ContentRoot" "../content/spinrealm"
  "BuildOutput" "../output"
  "Depots"
  {
    "YOUR_DEPOT_ID" "depot_windows.vdf"
  }
}

"DepotBuildConfig"
{
  "DepotID" "YOUR_DEPOT_ID"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "recursive" "1"
  }
}
```

这是两个文件的结构展示，分别保存为 app_build.vdf 和 depot_windows.vdf，并核对相对目录。此示例故意不指定 SetLive，避免上传时意外切换公开分支。正式参数和 SDK 目录以官方上传文档为准。[S08](https://partner.steamgames.com/doc/sdk/uploading)

### 发布账户与密钥

已发行产品把新构建设为默认分支时，Steam 有额外授权环节。官方文档说明该账户需要绑定电话号码或 Steam Mobile App；部分账户安全信息修改还会触发 3 天等待。不要把更新计划压在同一天修改账户安全资料。[S08](https://partner.steamgames.com/doc/sdk/uploading)

密码不写入仓库、VDF 或展示用命令；使用受控构建环境。保存成功的 Build ID、commit、版本说明和回滚目标，形成可追溯发布记录。


## 05 / SnowRealm 会员、Steam 身份与好友

建议 · 一套主账户，多种经过验证的登录入口

### 推荐的账户流程

- 获取 Steam 官方身份票据，交由 SnowRealm 后端验证，通过后才创建或登录内部用户。
- 已有账户的玩家主动绑定，并验证两边账户的所有权。不可按昵称、头像或玩家填写的 SteamID 自动合并。
- 网页 Steam 登录可采用官方 OpenID，与游戏内票据流程不同；任何页面都不应索取 Steam 密码。[S09](https://partner.steamgames.com/doc/features/auth)
- 展示关联状态、退出、设备会话和客服入口。解绑、迁移和重复绑定须有明确规则，避免权益转移漏洞。

Steam Publisher Web API key 仅保存在安全服务器。官方要求这类受保护请求来自服务器，密钥不能随客户端分发，涉及密钥的请求使用 HTTPS。[S17](https://partner.steamgames.com/doc/webapi_overview/auth)

| 数据 / 功能 | 建议归属 | 注意点 |
| --- | --- | --- |
| SnowRealm 用户编号 | 平台后端 | 作为跨游戏主键，不使用可修改的昵称。 |
| SteamID 绑定 | 平台后端 | 保存已验证的外部身份关联和绑定时间。 |
| 好友关系 | 平台后端 | 好友申请、接受、拒绝、拉黑、撤回和权限控制。 |
| Steam 好友邀请 | Steam 适配 + 房间服务 | 收到邀请后仍验证房间、版本和成员权限。 |
| 在线状态 | 平台后端 | 提供隐身或可见范围；不公开邮箱或登录标识。 |
| 订阅和购买权益 | 服务端权益账本 | 按平台、订单和有效期记录，不相信本地开关。 |

Steam Lobbies 可以帮助邀请和发现同一大厅中的玩家，但不会自动替你完成跨浏览器账户系统、排位规则和防作弊。跨平台房间仍需要自己的协议和可验证的对局服务。[S31](https://partner.steamgames.com/doc/features/multiplayer/matchmaking)

### 离线与登录边界

建议练习、电脑对战和本地设置允许离线；匹配、好友、排位和付费权益同步显示网络需求。离线分数不能未经验证直接兑换线上金币或提交排位。商店须如实披露第三方账户与联网要求，并说明断网可玩哪些内容。[S04](https://partner.steamgames.com/doc/store/review_process)


## 06 / 得分、金币、排位：有后端才有可信结果

建议 · 将公平性写进规则和账本

积分、金币和段位是三套不同数据。积分描述本局表现；金币是经济资产；段位描述匹配和竞技结果。把三者全部保存在浏览器 localStorage，玩家就能直接修改结果，因此不适合作为正式线上经济和排行榜的依据。

| 系统 | 建议设计 | 不可省略的校验 |
| --- | --- | --- |
| 本局得分 | 固定规则版本；记录消行、旋转、连击与其他奖励来源。 | 服务器复算或验证输入 / 回放；同一局只结算一次。 |
| 金币 | 对局结算、任务和活动奖励逐笔入账。 | 唯一事件编号、幂等性、余额约束、变动原因。 |
| 道具购买 | 公开固定价格；不足余额时阻止交易。 | 扣款和发货同一事务；重试不会重复扣币。 |
| 道具使用 | 仅派对房间开放；开局前展示规则。 | 消耗库存、冷却、目标和使用时间由服务端确认。 |
| 排位 | 规则一致、同等性能、无付费增益；赛季独立。 | 匹配版本、断线处理、异常结果、重赛和申诉。 |
| 皮肤权益 | 外观不改变碰撞、下落速度或得分。 | 所有权检查；退款 / 到期后恢复合法可用外观。 |

### Steam 排行榜如何接

Steam Leaderboards 可以设置 Trusted 写入：客户端不能直接提交分数，只能由相应 Web API 写入。建议正式榜单用可信后端提交，并保留可审计的结算与回放记录。Steam 排行榜只是显示和排序能力，不会自动证明比赛真实有效。[S14](https://partner.steamgames.com/doc/features/leaderboards)

### 需要的对局服务最小集合

- 匹配服务分清练习、休闲、道具派对、排位和团队；排位队列不混入未告知的机器人。
- 房间记录规则版本、玩家和随机种子；服务端验证关键输入、攻击和结束结果。
- 断线有明确的重连窗口与判负规则。超时、双方掉线和服务异常必须可以区分。
- 控制异常操作频率、脚本刷币、重复结算与账户串通；封禁和更正结果保留审计及申诉渠道。

> **产品取舍**
>
> 先让排位可信，再让排位热闹。付费用户如果能买到竞技优势，短期多卖道具，长期会把最愿意持续玩的核心玩家赶走。此处是商业与玩法建议，不是 Steam 对所有游戏强制规定的模式。


## 07 / 商业模式：外观订阅可以做，边界先定好

建议方案 · 不把价格或订阅开通状态当作已确认事实

| 项目 | 建议卖点 | 边界与风险 |
| --- | --- | --- |
| 免费基础体验 | 练习、电脑对战、核心匹配；基础皮肤与输入设置完整。 | 不要以更差手感或不可读棋盘强迫购买。 |
| 直接购买外观 | 主题、方块材质、棋盘背景、音效风格、个人展示。 | 明确预览与价格；不影响竞技判定。 |
| 订阅会员 | 自定义图片、扩展外观库、更多预设、跨设备保存。 | 必须有持续服务价值；到期保留什么写清楚。 |
| 金币与道具 | 金币兑换派对道具或部分外观。 | 首发建议金币靠游戏获得；不开放提现和玩家转卖。 |
| 支持者礼包 | 固定内容和清楚的永久权益。 | 适合作为更容易理解的一次性选择；仍须平台审核。 |
| 活动与赛季 | 免费赛季目标、赛事、可选装饰。 | 付费通行证不要承诺尚未确定且无法兑现的内容。 |

### Steam 版支付规则

游戏内交易必须使用 Steam Wallet 对应的微交易流程。不能在 Steam 游戏内把玩家带到不提供 Steam Wallet 的其他商店支付。网页上已有的 Stripe、信用卡或其他收款按钮，应由发行平台适配层处理，不能原样嵌入 Steam 构建。[S04](https://partner.steamgames.com/doc/store/review_process)[S06](https://partner.steamgames.com/doc/features/microtransactions)

### 广告模式需要调整

Steam 官方不支持游戏以付费广告为商业模式，也不支持看广告换金币、体力、道具或其他价值。若浏览器版以后加入奖励广告，Steam 版本必须移除对应机制；不要把“自愿看广告”误当作例外。[S16](https://partner.steamgames.com/doc/marketing/advertising)

### 如何定价与验证

先用免费测试测量用户留存、每位活跃用户的服务成本、外观预览转化和长期留存，再决定各地区价格。订阅应有月度内容 / 存储 / 服务的真实成本与价值；单纯开放本地选图功能是否足以支撑月费，需要用户实验验证。不要把尚未得到验证的价目表称为最终方案。

建议付费前清楚展示包含内容、自动续费与否、期限、取消入口、退款方式、图像保存和到期行为。首发减少付费品类，可以降低订单异常、客服和翻译维护成本。


## 08 / 订单、订阅、退款与跨平台权益

必须 + 建议 · 支付成功以服务端结果为准

### 微交易的实现顺序

服务端创建唯一订单，调用 InitTxn；玩家在 Steam 内授权后，服务端通过 FinalizeTxn 完成交易，成功后再发放物品。用 GetReport 持续对账，并处理退款、部分退款、拒付和疑似欺诈状态。官方要求至少每天核对交易状态；高频业务可更频繁。[S25](https://partner.steamgames.com/doc/features/microtransactions/implementation)

工程建议：授权回调可以重放，发货接口必须幂等；购买失败不扣金币、不发货。每项权益都能追溯到平台、订单、商品、实际有效期与回收原因，退款不能只删除一条订单记录。

### 订阅不能直接照搬网站会员

官方 Recurring Subscriptions 文档仍将其标为未完全支持的功能；自动续费需要用户同意的协议与相应计费流程，开发者负责到期和周期处理，不能任意提高约定的周期金额。实施前向 Steamworks 确认本项目的适用方案、测试方式与取消路径。[S07](https://partner.steamgames.com/doc/store/pricing/subscriptions)

建议先验证一次性外观购买。需要长期会员时，比较自动续费与非自动续费的固定期限权益；后者也须明确商品类型、发放与退款规则，不能用换个名字绕过支付要求。

| 类型 | 官方退款口径摘要 | 产品实现 |
| --- | --- | --- |
| 普通游戏购买 | 通常购买 14 天内且游玩少于 2 小时可申请。 | 不要以强制等待、刷时长方式阻碍退款。 |
| DLC | 通常 14 天内，购买 DLC 后基础游戏游玩少于 2 小时，且未消耗 / 修改 / 转移；存在标示的例外。 | 服务端记录可撤回权益，按真实退款状态处理。 |
| 第三方游戏内购 | 48 小时退款不是对所有第三方内购的统一承诺；是否提供该机制取决于开发者选择及显示条件。 | 上线前确认选项与实际购买页提示。 |
| 自动续费订阅 | 当前周期未使用时，通常可在首次购买或自动续费后 48 小时内申请；可取消后续续费。 | 取消与立即退款分开；明确剩余周期访问权。 |

本表仅摘要，完整条件、适用例外和消费者法定权利以 Steam 退款页为准；核查日 2026-11-18。[S12](https://store.steampowered.com/steam_refunds/)

> **待核实 · 跨平台共享**
>
> SnowRealm 可以设计统一权益账本，但 Steam 购买、网页购买、跨游戏订阅、虚拟币互通和付费道具共享的具体许可不能从“有一个账号”推导出来。提交商品及流转图给 Steamworks 确认，未确认前不要承诺全平台通用。


## 09 / 自定义图片：私人背景与公开分享

建议 · 先从可控制的个人用途开始

“会员可以上传自己的图片”会产生文件处理、隐私、版权和内容管理需求。建议首版仅允许玩家在自己的界面中使用，默认不展示给对手、不进入公开图库；公开分享、好友可见和创作者商店另行设计。

| 环节 | 首版建议 | 公开分享前增加 |
| --- | --- | --- |
| 上传 | 限已知图片格式；检查真实文件类型、尺寸和解码结果。 | 隔离处理、内容检测、人工复核和异常隔离。 |
| 图片处理 | 重编码成安全格式，剥离不必要元数据；生成适配尺寸。 | 多级预览、违规图屏蔽、撤回后的缓存清理。 |
| 存储 | 按用户隔离；私有权限或短期访问凭证；允许删除。 | 可见范围、举报、审核状态与管理员审计。 |
| 对局显示 | 本人看到自己的背景；默认竞技背景可一键恢复。 | 对手可关闭他人的图片，屏蔽状态全端生效。 |
| 订阅到期 | 事先说明保存多久、是否还能使用、如何导出 / 删除。 | 限制上传与删除账号的边界不能冲突。 |
| 用户责任 | 确认有使用权；禁止上传侵犯他人权益或违法内容。 | 明确发布许可、举报处理、申诉和下架流程。 |

### 私有也要有安全边界

本地选图不必自动上传服务器。若需要跨设备同步，应告诉玩家存储位置类别、用途、保留期限、删除方式和服务提供者范围。不要把图片默认为可用于训练或推广；如需要其他用途，另行说明并取得适当授权。隐私和未成年人措施须结合目标市场实际法律审查，本文件不代替法律意见。

### 如果接 Steam Workshop

Workshop 提供现成内容分发与社区能力，但接入仍需要上传路径、下载加载和内容验证。官方区分自由发布与精选内容模式；付费精选物品还需要持久的所有权记录及购买界面。因此“支持自定义背景”并不等同于已经支持 Workshop。[S22](https://partner.steamgames.com/doc/features/workshop)

Steam 的社区管理工具可对不合适、违规或被盗用的内容进行处理；这不取代你对自建图片服务器、游戏内昵称、聊天、头像和好友骚扰的处理流程。首发至少落实举报、拉黑、禁用公开图像和客服响应责任。[S23](https://partner.steamgames.com/doc/marketing/community_moderation)

> **建议 · 可读性不能变成付费负担**
>
> 每个主题都必须保持方块轮廓、落点、垃圾行和危险提示可辨。提供背景暗化、不透明度、默认背景与减少动态效果，让玩家能把图片调成“好看而不挡手”。


## 10 / 素材、商标、生成式 AI 与内容分级

必须 · 权利记录比“网上免费下载”更重要

### 建立素材权利清单

Steam 不接受缺少所有权或足够授权的内容。[S02](https://partner.steamgames.com/doc/gettingstarted/onboarding) 对音乐、音效、字体、图标、背景、方块样式、宣传图和代码依赖，保存名称、作者、原始网址、许可证版本、取得日期、允许的商用 / 修改 / 再分发范围、署名文本和证据文件。

免费不等于开源，开源也不等于没有义务。素材许可必须覆盖游戏内使用、Steam 下载包、宣传视频和可能的付费外观；音源、采样和字体也要分别核对。若“许可只允许在作品中使用”而不允许单独转售，就不能把原始素材包装成可下载素材包卖给用户。此处为权利核查方法，不是对未见许可证的结论。

### 不要把怀旧做成官方身份误认

Tetris 官方条款明确保护其名称、商标、标志和网站内容。不要从旧 Tetris Battle 或现有 Tetris 产品直接复制美术、音乐、文案、界面素材或代码，也不要把《旋界》宣传为官方续作、授权版本或官方复活。[S28](https://tetris.com/terms-conditions)

建议使用原创名称、视觉语言、音景和规则表达。某一具体玩法、画面组合或商标使用是否构成侵权，需要由具资格的专业人士按目标市场评估；“换了名字”并不是对所有知识产权问题的通行证。

### 生成式 AI 内容问卷如何填

必须完成 Steam 内容问卷。AI 部分聚焦玩家实际消费的生成内容，包括图像、音频、叙事和本地化等；单纯提升开发效率的工具使用不是同一口径。若交付的五语翻译或美术由生成式 AI 产生，应按当前问卷如实说明。预生成与游玩时实时生成的内容须分别处理；实时生成还需说明防止非法内容的措施。[S05](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)

### 分级与地区

真实完成一般内容、成人内容和 AI 三部分，未公开但随包上传的成人内容也不能隐瞒。自定义图像、聊天和社区分享会改变内容风险，应在功能变化后重新核对问卷。[S05](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)

德国商店要求有效年龄评级；没有有效评级的游戏自 2024-11-15 起不向当地顾客显示。填写问卷是 Valve 自评流程的重要输入，但不保证所有内容都能在德国销售。未经对应机构实际评定，不要自行填写 USK 评级。[S26](https://partner.steamgames.com/doc/gettingstarted/contentsurvey/germany)


## 11 / 五语言、商店页面与宣传素材

必须核对 · 支持语言不只是翻译开始按钮

| 界面名称 | Steam API 代码 | 常用网页语言标记 |
| --- | --- | --- |
| 简体中文 | schinese | zh-CN |
| 繁體中文 | tchinese | zh-TW |
| English | english | en |
| 日本語 | japanese | ja |
| 한국어 | koreana | ko |

Steam 语言代码以官方表为准。[S20](https://partner.steamgames.com/doc/store/localization/languages) 商店文案与游戏内本地化分别维护：菜单、规则、Hold、键位、支付 / 订阅说明、错误、匹配、好友申请、退款和服务维护通知都要覆盖。只翻译宣传页不代表游戏已支持该语言。[S21](https://partner.steamgames.com/doc/store/localization)

| 素材 | 当前尺寸 / 要求 | 来源 |
| --- | --- | --- |
| Header Capsule | 920 × 430 px | S10 |
| Small Capsule | 462 × 174 px | S10 |
| Main Capsule | 1232 × 706 px | S10 |
| Vertical Capsule | 748 × 896 px | S10 |
| 实际游戏截图 | 至少 5 张；最低 1920 × 1080，16:9 | S10 |
| Library Capsule | 600 × 900 px | S11 |
| Library Header | 920 × 430 px | S11 |
| Library Hero | 3840 × 1240 px；不含文字 | S11 |
| Library Logo | 透明 PNG；宽 1280 px 和 / 或高 720 px | S11 |

尺寸核查日：2026-11-18。发布前下载官方最新模板检查裁切安全区。普通胶囊图以游戏标题 / 标志与视觉识别为核心，避免评价分数、促销语和其他不符合规则的文字。截图应展示真实游戏，不用概念图假装玩法。[S10](https://partner.steamgames.com/doc/store/assets/standard)[S11](https://partner.steamgames.com/doc/store/assets/libraryassets)

### 商店内容审核前核对

仅列首发可用功能；未来计划清楚标记。五语、在线 PvP、好友、排位、成就、Cloud、手柄等功能标签，都要有实际版本证据。网页说明和桌面版本不同的地方要写清楚。商店描述正文不要放其他网站链接；需要外部资料时使用后台允许的专门位置。[S04](https://partner.steamgames.com/doc/store/review_process)


## 12 / 操作手感、可及性与 Steam Deck

建议验收目标 · 达到目标不等于自动获得认证

### 把核心操作做成可配置的能力

建议提供左右移动、软降、硬降、顺 / 逆时针旋转、Hold、暂停 / 返回以及派对道具的独立按键映射。界面要显示冲突、允许恢复默认、支持左右手预设，并分别保存键盘与手柄配置。不要让聊天输入和游戏快捷键同时触发。

DAS、ARR、锁定延迟等手感设置要有清楚解释和安全默认值。皮肤、背景动画、音乐和粒子效果不应拖慢输入处理；音乐与音效分开音量，提供一键静音和减少闪烁 / 动态效果。

### Steam Deck 的明确检查项

官方兼容性检查涉及完整手柄导航、正确按键提示、文本输入、启动器可操作与 Proton 兼容。Deck 推荐支持 1280×800 或 1280×720；在 1280×800 时最小文字字形高度不能低于 9 px，官方建议尽量达到 12 px。默认性能门槛与其他细项以完整检查表为准。[S13](https://partner.steamgames.com/doc/steamhardware/compat)

对《旋界》的工程目标可设为稳定 60 FPS 和低输入延迟；这是本项目建议，不是把官方兼容性最低门槛改写成 60 FPS。必须在真实设备或等效环境实测，不能只看开发电脑的帧数。

| 场景 | 验收重点 |
| --- | --- |
| 仅键盘 | 菜单、设置、登录后的游戏流程、对局和退出都可完成。 |
| 仅手柄 | 焦点可见；不需要鼠标点网页；输入昵称时有可用软键盘。 |
| 换肤 / 自定义背景 | 方块边界与落点仍清晰；色彩不是唯一提示。 |
| 繁 / 简 / 日 / 韩 | 字体无缺字；长句不被截断；字号可调时布局稳定。 |
| 暂停 / 失焦 / 休眠 | 单机可恢复；线上明确断线状态，不重复结算。 |
| 音频关闭 | 危险和成功提示仍有视觉反馈；设置重新启动后保留。 |

Steam 提供可及性功能声明入口。只勾选真正完成的音量、文字大小、颜色替代、对比度或输入能力；例如允许改变背景颜色，不自动意味着整个游戏已满足“无视觉游玩”。[S29](https://partner.steamgames.com/doc/accessibility_features)

> **必须准确描述**
>
> Deck Verified 等兼容标识由 Valve 的实际评审产生；未评审前只能描述自己的测试结果，不能自行宣称官方认证。[S13](https://partner.steamgames.com/doc/steamhardware/compat)


## 13 / 成就、云存档与发布前测试

建议 · 测试覆盖真正会伤害体验和资产的失败情形

### 成就和存档分工

Steam Stats and Achievements 支持持久统计和本地化成就信息。建议首批成就围绕完成教学、旋转技巧、练习里程碑和合作行为，而不是用金币付费解锁的荣誉。与线上竞技结果有关的成就应来自可信结算。[S33](https://partner.steamgames.com/doc/features/achievements)

Steam Cloud 可以同步存档文件，Auto-Cloud 也能按路径配置。建议同步单机纪录、键位、主题预设，按 Steam 用户隔离存档；机器专属显示设置避免盲目跨设备覆盖。金币、段位和订阅的权威状态仍放服务端，不能把 Cloud 文件当支付数据库。[S15](https://partner.steamgames.com/doc/features/cloud)

| 测试组 | 必须验证的故障 / 场景 | 通过证据 |
| --- | --- | --- |
| 全新安装 | 无开发环境、不同用户名 / 路径、缺少旧缓存。 | 从 Steam 下载后可直接启动。 |
| 规则与计分 | 旋转、Hold 限制、锁定、连击、攻击抵消和结束。 | 确定性回放与服务器结算一致。 |
| 账号 / 好友 | 错误票据、重复绑定、拉黑、撤回邀请、过期房间。 | 越权被拒绝，状态全端一致。 |
| 联机 / 排位 | 延迟、丢包、重连、双方掉线、版本不一致。 | 不死锁、不重复奖励，规则可解释。 |
| 经济 | 重复回调、并发购买、失败订单、余额不足。 | 账本平衡，无重复发货 / 负数漏洞。 |
| 订阅 / 退款 | 取消、过期、续费失败、退款与拒付。 | 权限正确变化，用户看得懂状态。 |
| 图片 / 主题 | 错误文件、超大文件、删除、无权访问。 | 拒绝危险输入，默认主题可恢复。 |
| 五语 / 输入 | 全部菜单、错误和支付说明，键鼠 / 手柄。 | 无硬编码漏翻或焦点困住。 |
| 离线 / 恢复 | 断网启动、存档冲突、服务维护、休眠。 | 已承诺模式可用，不伪造线上结果。 |
| 更新 / 回滚 | 旧客户端连新后端、版本迁移和回退。 | 可恢复到已知稳定构建。 |

测试结论应记录版本、设备、日期、步骤、结果与负责修复的人。只跑一次网页构建、只看到主菜单，或只在同一浏览器开两个窗口，都不足以证明真实跨机器对战和正式支付流程已经可用。


## 14 / 发售当天与长期运营

执行清单 · 先安排谁负责，再按发布按钮

### 上线前最后检查

- 商店与构建已通过；等待期满足；Steam 后台选择的是预定 Build ID；所有支持平台与语言验证完成。[S04](https://partner.steamgames.com/doc/store/review_process)[S19](https://partner.steamgames.com/doc/store/releasing)
- 默认分支可以安装，回滚构建已保留；线上数据库迁移已验证可恢复；服务配置指向生产环境。
- 价格、商品描述、订阅状态、取消 / 退款入口符合已确认方案；未开放的商业功能不会被玩家误当作已可购买。
- 音乐 / 字体 / 图片许可证、AI 问卷、年龄评级和隐私说明与实际发布包一致。
- 客服邮箱 / 工单、状态页、举报处理与值班负责人可用；公告和常见问题准备五语最少必要版本。

### 发布动作

具有相应权限的负责人在后台启动 Release App 流程，检查其列出的发布动作，确认后让产品正式可玩。之后使用普通玩家账户检查商店、安装、对局、支付和社区入口；不要仅以管理后台显示“成功”结束验证。[S19](https://partner.steamgames.com/doc/store/releasing)

### 运营仪表盘建议

| 指标 | 用途 |
| --- | --- |
| 崩溃 / 启动失败 / 服务错误率 | 判断是否需要暂停推广、切回稳定构建。 |
| 首次成功对局率 / 次日与七日留存 | 验证玩家是否真正玩懂并愿意回来。 |
| 匹配等待 / 延迟 / 掉线 / 重连成功 | 监控线上质量与地区容量。 |
| 金币产出 / 消耗 / 异常余额 | 发现经济失衡、刷币与重复结算。 |
| 支付成功 / 退款 / 续费失败 / 客诉 | 评估商业质量，避免只看总收入。 |
| 主题性能 / 可读性问题 / 举报处理时间 | 防止新内容伤害核心玩法或社区。 |

指标定义、采样与保留期限应写清楚。监控尽量使用匿名或最小必要的数据；排查问题需要的事件，不等于可以无限期收集所有玩家行为。

### 出现事故时

先暂停受影响的购买、奖励或比赛入口，保存必要审计记录，发布已确认事实；再修复、补发或回收权益。说明影响范围、恢复时间与玩家能做什么，不猜测根因。版本回滚和数据库回滚可能是两件事，必须预演。


## 15 / 两个实现都上线：怎么比较才有意义

建议 · 比较产品结果，避免把人群差异误当代码优劣

你准备让不同实现分别上线，这可以验证玩法与手感方向；但两个相近产品会分散玩家、好友关系和匹配人数。产品需要有玩家能理解的区别，例如竞速竞技与道具派对，而不是只因为开发工具不同就要求玩家理解两款商品。

### 发行结构选择

| 选择 | 适用情形 | 代价 |
| --- | --- | --- |
| 同一产品的测试版本 / 模式 | 规则和品牌基本一致，只比较操作与界面。 | 不适合把多个不兼容客户端随意混入同一排位。 |
| 两个独立产品 | 玩法、定位、内容和长期维护计划有明确差异。 | 各自费用、审核、商店、客服与玩家池；需解释关系。 |
| 先网页比较，再决定 Steam | 需要快速测首局转化与留存。 | 网页数据不自动代表 Steam 用户偏好。 |

本次核查没有发现一条公开规则足以保证两款高度相似游戏会通过审核。应把差异说明、截图、内容与维护承诺提交 Steamworks 询问，而不是承诺“只要两个 App ID 就一定没问题”。每个独立新应用的费用按官方规则分别计算。[S01](https://partner.steamgames.com/doc/gettingstarted/appfee)

### 公平实验的建议

- 记录来源渠道、地区、设备、时间段和熟练度；在相近招募条件下比较。
- 同时看首局完成、输入满意度、七日留存、有效对局和好友邀请，不只看累计注册数。
- 记录两版本的内容、活动和价格差异；不能把一个版本有广告曝光、另一个没有带来的流量差异当成技术胜负。
- 跨版本账号和资产共享先定规则；排位算法、反作弊和付费价值不同，不应未经验证直接混排或互换。

### 评论与评价边界

Steam 禁止操纵评价和用游戏、DLC、钱或其他奖励换评价，官方也要求不要在游戏内请求玩家写评测。不要用“评价送金币”、组织刷好评或多个账户投票比较两个版本；免费给媒体 / 内容创作者评测样本的例外也不意味着可以买正面结论。[S18](https://partner.steamgames.com/doc/store/reviews)

> **判断标准**
>
> 更值得留下的不是“哪边代码写得更快”，而是哪个版本让玩家愿意持续回来、愿意邀请朋友，并且运营成本可承受。两个版本的数据应帮助做选择，而不是永久维持两套几乎相同的维护负担。


## 16 / 上线闸门与需要 Steamworks 答复的问题

交接页 · 可以直接变成任务追踪清单

| 闸门 | 可发布的最低证据 | 负责角色 |
| --- | --- | --- |
| 发行主体 | 协议、身份、银行税务和 App ID 已完成。 | 发行 / 财务 |
| 产品身份与权利 | 原创资产记录、授权、两版本差异说明。 | 产品 / 美术 / 发行 |
| 实际桌面构建 | Windows 干净环境安装、启动、单机与声明功能通过。 | 客户端工程 / QA |
| 线上服务 | 真实跨设备账户、好友、房间、匹配与可信结算。 | 后端 / QA |
| 商业能力 | Steam 支付、订单对账、权益与退款测试通过。 | 支付工程 / 客服 |
| 公开内容能力 | 图片权限、举报、拉黑、删除与审核责任落实。 | 后端 / 社区运营 |
| 商店与问卷 | 五语、素材、功能标签、AI / 分级与实际一致。 | 本地化 / 发行 |
| 运营与恢复 | 监控、备份、回滚、状态说明与值班机制。 | 运维 / 发行 |

### 提交给 Steamworks 的问题应具体到方案

- 《旋界》拟以免费核心 + 付费外观发行；会员包含自定义图片、云端保存和外观库。哪种订阅 / 固定期限商品配置适合？自动续费是否可启用，如何测试取消和退款？
- Steam 和网页版共用 SnowRealm 账户。哪些已购买外观 / 虚拟币 / 订阅权益可以跨平台使用？Steam 客户端应如何呈现跨平台状态而不违规引导外部支付？
- 未来会员若覆盖「旋界、52、电梯」，该跨游戏权益范围是否符合相应产品与计费设置？
- 两款类似方块游戏将各自发布：附上真实差异、截图、玩法和维护计划，请确认应使用独立 App、模式、Demo 还是其他结构。
- 图片最初为私人自用，将来可能加入公开分享与创作者内容；内容问卷、Workshop 和审核应在何时更新？

不要把问题只写成“能不能上架”。附可运行构建、商品流转图、权益到期示例、退款处理和具体商店文案，更容易得到能执行的答复。保留支持工单编号和答复日期。

> **当前未由本文完成的动作**
>
> 本文没有创建 Steamworks 账户、提交银行 / 税务资料、支付 Steam Direct 费用、创建 App ID、上传发行构建或按下正式发布按钮。只有实际后台操作与验收完成后，才能把对应闸门标记为通过。


## 官方来源索引 / 1

所有链接核查于 2026-11-18 · 以当前正文与后台为准

**S01 · Steam Direct Fee**  
https://partner.steamgames.com/doc/gettingstarted/appfee  
核查日期：2026-11-18

**S02 · Onboarding**  
https://partner.steamgames.com/doc/gettingstarted/onboarding  
核查日期：2026-11-18

**S03 · Steam Direct**  
https://partner.steamgames.com/steamdirect  
核查日期：2026-11-18

**S04 · Review Process**  
https://partner.steamgames.com/doc/store/review_process  
核查日期：2026-11-18

**S05 · Content Survey**  
https://partner.steamgames.com/doc/gettingstarted/contentsurvey  
核查日期：2026-11-18

**S06 · Microtransactions**  
https://partner.steamgames.com/doc/features/microtransactions  
核查日期：2026-11-18

**S07 · Recurring Subscriptions**  
https://partner.steamgames.com/doc/store/pricing/subscriptions  
核查日期：2026-11-18

**S08 · Uploading to Steam / SteamPipe**  
https://partner.steamgames.com/doc/sdk/uploading  
核查日期：2026-11-18

**S09 · User Authentication and Ownership**  
https://partner.steamgames.com/doc/features/auth  
核查日期：2026-11-18

**S10 · Store Graphical Assets**  
https://partner.steamgames.com/doc/store/assets/standard  
核查日期：2026-11-18

**S11 · Library Assets**  
https://partner.steamgames.com/doc/store/assets/libraryassets  
核查日期：2026-11-18


## 官方来源索引 / 2

所有链接核查于 2026-11-18 · 以当前正文与后台为准

**S12 · Steam Refunds**  
https://store.steampowered.com/steam_refunds/  
核查日期：2026-11-18

**S13 · Steam Deck / Steam Machine Compatibility Review**  
https://partner.steamgames.com/doc/steamhardware/compat  
核查日期：2026-11-18

**S14 · Steam Leaderboards**  
https://partner.steamgames.com/doc/features/leaderboards  
核查日期：2026-11-18

**S15 · Steam Cloud**  
https://partner.steamgames.com/doc/features/cloud  
核查日期：2026-11-18

**S16 · Advertising on Steam**  
https://partner.steamgames.com/doc/marketing/advertising  
核查日期：2026-11-18

**S17 · Authentication using Web API Keys**  
https://partner.steamgames.com/doc/webapi_overview/auth  
核查日期：2026-11-18

**S18 · User Reviews**  
https://partner.steamgames.com/doc/store/reviews  
核查日期：2026-11-18

**S19 · Release Process**  
https://partner.steamgames.com/doc/store/releasing  
核查日期：2026-11-18

**S20 · Languages Supported on Steam**  
https://partner.steamgames.com/doc/store/localization/languages  
核查日期：2026-11-18

**S21 · Localization and Languages**  
https://partner.steamgames.com/doc/store/localization  
核查日期：2026-11-18

**S22 · Steam Workshop**  
https://partner.steamgames.com/doc/features/workshop  
核查日期：2026-11-18


## 官方来源索引 / 3

所有链接核查于 2026-11-18 · 以当前正文与后台为准

**S23 · Community Moderation**  
https://partner.steamgames.com/doc/marketing/community_moderation  
核查日期：2026-11-18

**S24 · Steam Playtest**  
https://partner.steamgames.com/doc/features/playtest  
核查日期：2026-11-18

**S25 · Microtransactions Implementation Guide**  
https://partner.steamgames.com/doc/features/microtransactions/implementation  
核查日期：2026-11-18

**S26 · Age Ratings Mandatory in Germany**  
https://partner.steamgames.com/doc/gettingstarted/contentsurvey/germany  
核查日期：2026-11-18

**S27 · Taxes FAQ**  
https://partner.steamgames.com/doc/finance/taxfaq  
核查日期：2026-11-18

**S28 · Tetris Terms of Use**  
https://tetris.com/terms-conditions  
核查日期：2026-11-18

**S29 · Accessibility Features**  
https://partner.steamgames.com/doc/accessibility_features  
核查日期：2026-11-18

**S30 · Early Access**  
https://partner.steamgames.com/doc/store/earlyaccess  
核查日期：2026-11-18

**S31 · Steam Matchmaking & Lobbies**  
https://partner.steamgames.com/doc/features/multiplayer/matchmaking  
核查日期：2026-11-18

**S32 · Steamworks API Overview**  
https://partner.steamgames.com/doc/sdk/api  
核查日期：2026-11-18

**S33 · Stats and Achievements**  
https://partner.steamgames.com/doc/features/achievements  
核查日期：2026-11-18
