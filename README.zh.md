# dsh-image-preview

[English](README.md) | 简体中文

为 DeepSeek Harness 内置的 `read_image` 工具提供内联图像预览。

本插件使用 DSH 的公开会话级 `tool.call.toolview` 插槽。由于官方工具树通过同一插槽分派嵌套子调用，因此一个渲染器可以同时覆盖：

- 直接的 `read_image` 调用；以及
- 嵌套在 `run_code` Code Mode 中的 `tools.read_image(...)` 调用。

每个已加载的预览都包含 **Copy image**，并提供可见的成功或失败反馈。在支持的情况下会直接复制 PNG 字节；必要时，其他受支持的格式会在浏览器中转换为 PNG。

## 安全性与生命周期

- 仅通过 `ctx.sessions.binding(sessionId).session.readAttachment(attachmentId)` 获取字节。
- 模型提供的文件路径仅作为显示/导航元数据，浏览器插件绝不会重新读取该路径。
- 仅渲染经过身份验证的 PNG、JPEG、WebP 和 GIF 附件响应。
- Blob URL 会在替换、重试、卸载和 HMR 清理时被撤销。
- 剪贴板复制使用同一个经过身份验证的附件 Blob；有界的浏览器内转换绝不会重新读取模型提供的路径，也不会添加网络回退。
- 格式错误/旧版结果和附件 RPC 失败会降级为有界的内联错误，不提供文件系统或网络回退。

## 设置

本插件在 DSH Settings → Plugins 下提供一个 **Image previews** 卡片，其中包含两个实时生效且持久保存的选项：

- **Enable inline previews** — 禁用后会移除自定义渲染器，并恢复 DSH 的通用工具行。
- **Open previews automatically** — 禁用后，每张图像最初都会折叠，只有点击 **Show preview** 后才会加载。

## 开发

```sh
pnpm install
pnpm check
```

本软件包遵循官方的 [Harness 插件指南](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/)：它导出函数形式的主机插件，声明 `dsh.bundle` 补丁，提供 Web 客户端入口，声明其注入的公开软件包，并通过生命周期 effect 实现明确的清理。

## 安装到配置文件

使用 tarball 可避免 Git 构建权限问题，并且在检出路径包含空格时也更可靠：

```sh
pnpm pack --pack-destination "$HOME/.dsh/packages"
dsh plugin --profile web add "$HOME/.dsh/packages/dsh-image-preview-0.3.0.tgz"
dsh --profile web --dump-config
```

安装命令会添加软件包依赖，并将 `dsh-image-preview` 追加到配置文件的有序 bundle 列表中。正在运行的 Web 配置文件加载新 bundle 后，请刷新页面；首次挂载主机插件需要经操作员批准后重启 Web。
