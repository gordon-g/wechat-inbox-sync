# WeChat Inbox Sync

把微信生态里看到的文章 / 图片 / 视频 / 文字，经配套小程序转发到 Obsidian，自动沉淀成带 **双链** 的知识库笔记；反过来，Obsidian 里整理好的笔记也能一键发布回小程序，在手机上浏览。插件内置 **AI 对话视图**，对话自动存档成文档，下次打开自动续接。

## 架构

```
 微信分享 / 粘贴          手机端「WeChat Inbox Sync」小程序
       │                           │
       │  HTTPS                    ▼
       └──────────►   sync-backend（Node/Express 中枢）
                               │  HTTPS + deviceToken
                               ▼
                  Obsidian 插件（本仓库）：绑定码配对 → 自动拉取生成双链笔记
```

三端通过「**绑定码 + 设备 Token**」配对，无需配置 API Key：

1. 小程序「绑定 Obsidian」页生成 6 位绑定码。
2. 在插件设置页输入该绑定码，点击「立即绑定」完成配对。
3. 小程序「收集」页保存的内容，会自动同步到该 Obsidian 知识库。

## 功能

- **绑定码配对**：小程序生成绑定码，插件输入即配对，免去手动配置地址/密钥。
- **自动同步**：Obsidian 启动后自动拉取小程序内容，并支持定时轮询（默认 5 分钟）。
- **双链笔记**：拉取的内容生成带 frontmatter 的笔记，按标题自动互链 `[[...]]` 并维护标签 Hub。
- **发布回小程序**：把当前笔记一键发布，在手机小程序「已发布」页浏览。
- **AI 对话视图**：在 Obsidian 内与 AI 对话，自动续接上次文档（需配置 OpenAI 兼容接口）。

## 安装

方式一（手动）：
1. 下载插件包（`main.js` / `manifest.json` / `styles.css`）。
2. 放到 vault 的 `.obsidian/plugins/wechat-inbox-sync/` 目录。
3. Obsidian 设置 → 社区插件 → 关闭安全模式 → 启用「WeChat Inbox Sync」。

方式二（社区插件市场）：在 Obsidian 社区插件市场搜索 **WeChat Inbox Sync** 直接安装。

## 配置

插件设置项：
- **后端地址**：`sync-backend` 的地址，真机调试用电脑局域网 IP（如 `http://192.168.x.x:8787`）。
- **绑定码**：从小程序「绑定 Obsidian」页获取的 6 位字符。
- **自动同步**：启动后自动拉取、轮询间隔。
- **AI 对话**：API Base URL / Key / 模型名（可选）。

## 配套服务

- 后端 `sync-backend`：https://github.com/gordon-g/...（自托管 Node 服务）
- 小程序：微信中搜索「WeChat Inbox Sync」或扫码体验。

## 许可

MIT
