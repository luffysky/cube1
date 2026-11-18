# Third-party notices / 第三方授权说明

## 浏览器认证组件

网页分发的 `neon-auth.mjs` 包含第三方开源代码。完整、未经改写的上游许可和版权文本随可部署资源一同提供：

- [完整许可与版权文本](dist/games/spinrealm/vendor/THIRD_PARTY_NOTICES.txt)
- [组件版本、来源、完整性与许可文件哈希](dist/games/spinrealm/vendor/third-party-components.json)

本次对锁定依赖重新生成内存中的 bundle，并确认与分发文件逐字节一致；依据 esbuild metafile，只列入实际贡献代码的 11 个包。`@neon/auth` 0.8.2 使用 Apache-2.0，`tslib` 2.8.1 使用 0BSD，其余 9 个包使用 MIT。具体版本、原始版权声明和全文以随附文件为准。构建时进行了合并、删除未使用代码和压缩；未手动修改上游源码。

更新 Auth SDK、锁文件或构建参数时，必须重新检查实际 bundle 组成并同步这些文件。`package-lock.json` 的所有依赖不等于浏览器实际分发的依赖；本清单不把构建工具或被移除的代码列为运行时组件。

## 音乐与音效

音乐来自 Cleyton Kauffman，音效来自 Kenney；素材按各自 CC0 声明使用，作者、原始文件、来源及处理记录保留在：

- [音频原始授权与作者声明](dist/games/spinrealm/audio/LICENSES.txt)
- [素材来源与文件哈希](dist/games/spinrealm/audio/credits.json)

这些作品与第三方认证组件不属于 SnowRealm Games 原创资产。作者署名不表示其认可本游戏。

## 桌面及其他代码

桌面分发中的 Electron、Chromium、Node.js 等运行时有各自的许可及第三方声明；应保留打包工具随运行时提供的 `LICENSE`、`LICENSES.chromium.html` 等文件。本清单只覆盖网页认证 bundle 与上述音频，不替代服务器依赖或桌面运行时的授权清单。

第三方许可只适用于其相应组件，不改变本项目其他代码、美术、商标或品牌的权利状态。
