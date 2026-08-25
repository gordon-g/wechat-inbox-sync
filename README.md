# WeChat Content Sync

[中文] 把微信生态里看到的文章 / 图片 / 视频 / 文字，经配套小程序转发到知识库，自动沉淀成带 **双链** 的笔记；反过来，Obsidian 里整理好的笔记也能一键发布回小程序，在手机上浏览。插件内置 **AI 对话视图**，对话自动存档成文档，下次打开自动续接。

[English] Forward articles, images, videos and text from WeChat into your knowledge base as **backlinked** notes via a companion mini-program. You can also publish notes from Obsidian back to the mini-program for mobile reading. The plugin includes an **AI chat view** that auto-saves conversations as documents and resumes the previous doc next time.

## 架构 / Architecture

```
 WeChat share / paste          Mobile "WeChat Content Sync" mini-program
       │                                  │
       │  HTTPS                           ▼
       └──────────►   sync-backend (Node/Express hub)
                            │  HTTPS + deviceToken
                            ▼
               Obsidian plugin (this repo): pairing code → auto-pull → backlinked notes
```

三端通过「**绑定码 + 设备 Token**」配对，无需配置 API Key：

1. 小程序「绑定 Obsidian」页生成 6 位绑定码。
2. 在插件设置页输入该绑定码，点击「立即绑定」完成配对。
3. 小程序「收集」页保存的内容，会自动同步到该知识库。

Pairing works via a **pairing code + device token**, no API key needed:

1. The mini-program generates a 6-digit pairing code on the "Bind Obsidian" page.
2. Enter the code in the plugin settings and click "Bind Now".
3. Items saved in the mini-program are automatically pulled into your vault.

## 功能 / Features

- **绑定码配对 / Pairing code**: 小程序生成绑定码，插件输入即配对，免去手动配置地址/密钥。The mini-program generates a code; enter it in the plugin to pair.
- **自动同步 / Auto sync**: Obsidian 启动后自动拉取小程序内容，并支持定时轮询（默认 5 分钟）。Auto-pull on startup with optional polling (default 5 min).
- **双链笔记 / Backlinked notes**: 拉取的内容生成带 frontmatter 的笔记，按标题自动互链 `[[...]]` 并维护标签 Hub。Incoming items become frontmatter notes with automatic `[[...]]` links and tag hubs.
- **发布回小程序 / Publish back**: 把当前笔记一键发布，在手机小程序「已发布」页浏览。Publish the current note back to the mini-program for mobile reading.
- **AI 对话视图 / AI chat view**: 在 Obsidian 内与 AI 对话，自动续接上次文档（需配置 OpenAI 兼容接口）。Chat with AI inside Obsidian; resumes the previous doc (requires an OpenAI-compatible endpoint).

## 安装 / Installation

### 方式一：社区插件市场（推荐）/ Method 1: Community plugin market (recommended)

1. 打开 Obsidian → 设置 → 社区插件 → 关闭安全模式。
2. 浏览社区插件，搜索 **WeChat Content Sync**。
3. 点击安装并启用。

1. Open Obsidian → Settings → Community plugins → turn off Safe mode.
2. Browse community plugins and search for **WeChat Content Sync**.
3. Install and enable it.

### 方式二：手动安装 / Method 2: Manual install

1. 从 [Releases](https://github.com/gordon-g/wechat-inbox-sync/releases) 下载最新版的 `main.js`、`manifest.json`、`styles.css`。
2. 在 vault 中创建目录 `.obsidian/plugins/wechat-content-sync/`。
3. 把三个文件放进去。
4. 重启 Obsidian，在 设置 → 社区插件 中启用「WeChat Content Sync」。

1. Download the latest `main.js`, `manifest.json` and `styles.css` from [Releases](https://github.com/gordon-g/wechat-inbox-sync/releases).
2. Create `.obsidian/plugins/wechat-content-sync/` in your vault.
3. Copy the three files into that folder.
4. Restart Obsidian and enable "WeChat Content Sync" in Settings → Community plugins.

## 使用 / Usage

1. **部署后端 / Deploy the backend**: 克隆并运行 [`sync-backend`](https://github.com/gordon-g/wechat-inbox-sync/tree/main/sync-backend)（Node/Express），默认监听 `http://localhost:8787`。
2. **小程序绑定 / Bind the mini-program**: 在微信小程序「WeChat Content Sync」里点击「绑定 Obsidian」，获得 6 位绑定码。
3. **插件绑定 / Bind the plugin**: 在 Obsidian 插件设置中填写后端地址和绑定码，点击「立即绑定」。
4. **同步 / Sync**: 保存的内容会自动拉取到 vault 的默认目录；你也可用命令面板手动「立即拉取」。

1. Clone and run the [`sync-backend`](https://github.com/gordon-g/wechat-inbox-sync/tree/main/sync-backend) (Node/Express), default `http://localhost:8787`.
2. In the WeChat mini-program, tap "Bind Obsidian" to get a 6-digit pairing code.
3. In Obsidian plugin settings, enter the backend URL and the pairing code, then click "Bind Now".
4. Saved items are automatically pulled into the vault; you can also run "Pull now" from the command palette.

## 配置 / Settings

- **后端地址 / Backend URL**: `sync-backend` 的地址，真机调试用电脑局域网 IP（如 `http://192.168.x.x:8787`）。
- **绑定码 / Pairing code**: 从小程序「绑定 Obsidian」页获取的 6 位字符。
- **自动同步 / Auto sync**: 启动后自动拉取、轮询间隔。
- **AI 对话 / AI chat**: API Base URL / Key / 模型名（可选）。

## 配套服务 / Companion services

- 后端 `sync-backend`: 本仓库 `sync-backend/` 目录（自托管 Node 服务）。
- 小程序：微信中搜索「WeChat Content Sync」或扫码体验。

## 许可 / License

MIT © gordon-g
