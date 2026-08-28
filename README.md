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

> ⚠️ **本插件不在 Obsidian 社区插件市场。** 它仅通过 **BRAT** 或 **手动** 两种方式分发。
> 社区市场里有一个名字近似的 **「WeChat Inbox Sync」**（作者 Zhang Zhang）是**另一款第三方插件**，功能与本项目无关，**请勿混淆安装**。

> ⚠️ This plugin is **NOT** on the Obsidian Community plugin store. It is distributed only via **BRAT** or **manual** install. The similarly-named **"WeChat Inbox Sync"** on the Community store is a **different third-party plugin** by Zhang Zhang — do not confuse it with this one.

### 方式一：BRAT 安装（推荐）/ Method 1: BRAT (recommended)

1. 社区插件市场安装并启用 **BRAT**（搜索 `obsidian42-brat`）。
2. 命令面板（Cmd/Ctrl+P）→ `BRAT: Add a beta plugin for testing`。
3. 填入仓库地址：`gordon-g/wechat-inbox-sync`。
4. 重启 Obsidian，在 设置 → 社区插件 中启用「WeChat Content Sync」。

1. Install and enable **BRAT** from the Community store (search `obsidian42-brat`).
2. Command palette (Cmd/Ctrl+P) → `BRAT: Add a beta plugin for testing`.
3. Enter the repo: `gordon-g/wechat-inbox-sync`.
4. Restart Obsidian and enable "WeChat Content Sync" in Settings → Community plugins.

### 方式二：手动安装 / Method 2: Manual install

1. 从 [Releases](https://github.com/gordon-g/wechat-inbox-sync/releases) 下载最新版的 `main.js`、`manifest.json`、`styles.css`。
2. 在 vault 中创建目录 `.obsidian/plugins/wechat-content-sync/`。
3. 把三个文件放进去。
4. 重启 Obsidian，在 设置 → 社区插件 中启用「WeChat Content Sync」。

1. Download the latest `main.js`, `manifest.json` and `styles.css` from [Releases](https://github.com/gordon-g/wechat-inbox-sync/releases).
2. Create `.obsidian/plugins/wechat-content-sync/` in your vault.
3. Copy the three files into that folder.
4. Restart Obsidian and enable "WeChat Content Sync" in Settings → Community plugins.

## 更新 / Update

通过 BRAT 安装的用户，更新只需：

- 命令面板（Cmd/Ctrl+P）→ `BRAT: Check for updates for all beta plugins`；或
- `BRAT: Update a single beta plugin` → 选 **WeChat Content Sync**。

更新后**重启 Obsidian**（Cmd/Ctrl+R）以加载新版本。

Users installed via BRAT can update with:

- Command palette (Cmd/Ctrl+P) → `BRAT: Check for updates for all beta plugins`; or
- `BRAT: Update a single beta plugin` → pick **WeChat Content Sync**.

Restart Obsidian (Cmd/Ctrl+R) after updating.

## 从旧版本迁移（插件 id 曾变更）/ Migrate from an old plugin id

早期版本（v1.0.0 的 `wechat-inbox-sync`、v1.0.1 的 `obsidian-wechat-sync`）因 **manifest id 与现版（v1.0.2+ 的 `wechat-content-sync`）不同**，BRAT 无法直接覆盖更新，会报错「无法安装」。请手动迁移一次：

1. 设置 → 第三方插件 → 禁用并**卸载**旧插件（其文件夹名为 `wechat-inbox-sync` 或 `obsidian-wechat-sync`）。
2. 用 BRAT 重新添加 `gordon-g/wechat-inbox-sync`（见上方安装步骤）。
3. 启用新插件，重启 Obsidian。

> 约定：自 **v1.0.2 起，插件 id 永久锁定为 `wechat-content-sync`**，后续所有版本均可平滑更新。

Early versions (v1.0.0 `wechat-inbox-sync`, v1.0.1 `obsidian-wechat-sync`) used a **different manifest id** than the current `wechat-content-sync` (v1.0.2+). BRAT cannot overwrite across an id change and will report "failed to install". Migrate manually once:

1. Settings → Community plugins → disable and **uninstall** the old plugin (folder `wechat-inbox-sync` or `obsidian-wechat-sync`).
2. Re-add via BRAT with `gordon-g/wechat-inbox-sync` (see Installation above).
3. Enable the new plugin and restart Obsidian.

> Convention: the plugin id is **locked to `wechat-content-sync`** since v1.0.2, so every later version updates smoothly.

## macOS / iCloud 用户注意 / Notes for macOS (iCloud) users

> **症状**：通过 BRAT 更新时提示「无法安装 / failed to install」，但 GitHub 上的 Release 与文件都正常。
> **根因**：vault 放在 `~/Documents` 或 `~/Desktop` 下、且开启了 iCloud「桌面与文稿」同步时，iCloud 在同步过程中会临时锁定目录，导致 BRAT（Obsidian 进程）写入 `.obsidian/plugins/wechat-content-sync/` 失败。
> **这是 macOS 的环境限制，不是本插件缺陷，也无法在插件代码内修复。**

**推荐做法（一次性解决，永久免踩坑）**：把 vault 移出 iCloud 同步目录。

1. 退出 Obsidian。
2. 把 vault 文件夹从 `~/Documents/...` 移到非同步目录，例如 `~/Obsidian/你的库名/`。
3. 重新用 Obsidian 打开该 vault（File → Open another vault）。
4. 之后 BRAT 更新一路畅通，再无写锁。

> 若暂时不便移动 vault，可在更新时**临时关闭 iCloud「桌面与文稿」同步**（系统设置 → Apple ID → iCloud → 关闭「桌面与文稿」），更新完再打开。注意：WorkBuddy / 其它沙箱进程即使在这种状态下也仍可能被 macOS TCC 挡住读 `~/Documents`，因此**插件安装/更新只能由你本机的 Obsidian 完成**，不要指望外部工具替你写进 vault。

**Symptom**: BRAT update fails with "failed to install" even though the GitHub Release and assets are fine.
**Cause**: when the vault lives under `~/Documents` or `~/Desktop` with iCloud "Desktop & Documents" sync on, iCloud transiently locks the folder during sync, blocking BRAT (the Obsidian process) from writing to `.obsidian/plugins/wechat-content-sync/`. This is a macOS environment limitation, not a plugin bug, and cannot be fixed in plugin code.

**Recommended fix (permanent)**: move the vault out of any iCloud-synced folder (e.g. to `~/Obsidian/your-vault/`) and reopen it in Obsidian.

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
