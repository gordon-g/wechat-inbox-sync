import { App, PluginSettingTab, Setting } from 'obsidian';
import type WechatSyncPlugin from './main';

export interface WechatSyncSettings {
  // 后端
  backendUrl: string;
  // 设备绑定
  deviceId: string; // 本机插件唯一标识，生成后不变
  deviceName: string;
  deviceToken: string; // 绑定成功后后端返回，等同登录态
  pairingCodeInput: string; // 设置页临时输入
  autoSyncOnStartup: boolean;
  syncIntervalMinutes: number; // 0 表示不自动轮询
  // 知识库落库
  inboxFolder: string;
  attachmentsFolder: string; // 微信图片/PDF 等附件下载到 vault 的目录
  autoLinkByTitle: boolean;
  // AI 对话
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  conversationFolder: string;
  resumeLastConversation: boolean;
  systemPrompt: string;
}

export const DEFAULT_SETTINGS: WechatSyncSettings = {
  backendUrl: 'http://localhost:8787',
  deviceId: '',
  deviceName: '我的电脑',
  deviceToken: '',
  pairingCodeInput: '',
  autoSyncOnStartup: true,
  syncIntervalMinutes: 5,
  inboxFolder: '微信收藏',
  attachmentsFolder: '微信收藏/附件',
  autoLinkByTitle: true,
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  conversationFolder: 'AI对话',
  resumeLastConversation: true,
  systemPrompt: '你是一个知识管理助手，帮助用户整理和连接他的笔记。用中文回答，简洁有条理。',
};

export class WechatSyncSettingTab extends PluginSettingTab {
  plugin: WechatSyncPlugin;

  constructor(app: App, plugin: WechatSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('后端连接').setHeading();
    new Setting(containerEl)
      .setName('后端地址')
      .setDesc('sync-backend 的地址，手机真机调试用电脑局域网 IP')
      .addText((t) =>
        t
          .setPlaceholder('http://localhost:8787')
          .setValue(this.plugin.settings.backendUrl)
          .onChange(async (v) => {
            this.plugin.settings.backendUrl = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName('绑定 Obsidian').setHeading();
    containerEl.createEl('p', {
      text: '1. 在微信小程序「绑定 Obsidian」页点击「查看绑定码」\n2. 把 6 位绑定码填入下方，点击「立即绑定」\n3. 手机 / 电脑 / 家人微信可各自生成绑定码，都绑到本 Obsidian，作为独立入口\n4. 绑定成功后，插件会自动拉取小程序收集的内容',
    });

    new Setting(containerEl)
      .setName('绑定码')
      .setDesc('从小程序获取的 6 位字符')
      .addText((t) =>
        t
          .setPlaceholder('例如 A1B2C3')
          .setValue(this.plugin.settings.pairingCodeInput)
          .onChange(async (v) => {
            this.plugin.settings.pairingCodeInput = v.trim().toUpperCase();
            await this.plugin.saveSettings();
          })
      )
      .addButton((b) =>
        b
          .setButtonText('立即绑定')
          .setCta()
          .onClick(async () => {
            await this.plugin.bindWithCode(this.plugin.settings.pairingCodeInput);
            this.display();
          })
      );

    new Setting(containerEl)
      .setName('本机设备名')
      .addText((t) =>
        t.setValue(this.plugin.settings.deviceName).onChange(async (v) => {
          this.plugin.settings.deviceName = v.trim() || '我的电脑';
          await this.plugin.saveSettings();
        })
      );

    const bindStatus = containerEl.createEl('div', { cls: 'sync-bind-status' });
    if (this.plugin.settings.deviceToken) {
      bindStatus.createEl('p', {
        text: `✅ 已绑定：${this.plugin.settings.deviceName}（${this.plugin.settings.deviceToken.slice(0, 8)}...）`,
        cls: 'sync-bind-ok',
      });
      new Setting(containerEl)
        .setName('解除绑定')
        .setDesc('清除本机 deviceToken，需要重新输入绑定码')
        .addButton((b) =>
          b.setButtonText('解除绑定').onClick(async () => {
            this.plugin.unbindDevice();
            this.display();
          })
        );

      // 多入口：列出本 Obsidian 的所有绑定码，可单独移除
      const entriesEl = containerEl.createEl('div', { cls: 'sync-entries' });
      this.loadEntries(entriesEl);
    } else {
      bindStatus.createEl('p', { text: '⏳ 未绑定，请输入小程序上的绑定码', cls: 'sync-bind-wait' });
    }

    new Setting(containerEl).setName('自动同步').setHeading();
    new Setting(containerEl)
      .setName('启动后自动同步')
      .setDesc('Obsidian 打开后自动拉取小程序待同步内容')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoSyncOnStartup).onChange(async (v) => {
          this.plugin.settings.autoSyncOnStartup = v;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('自动轮询间隔（分钟）')
      .setDesc('0 表示只手动同步；建议 5 分钟')
      .addSlider((s) =>
        s
          .setLimits(0, 30, 1)
          .setValue(this.plugin.settings.syncIntervalMinutes)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.syncIntervalMinutes = v;
            await this.plugin.saveSettings();
            this.plugin.restartSyncInterval();
          })
      );

    new Setting(containerEl).setName('知识库').setHeading();
    new Setting(containerEl)
      .setName('收藏文件夹')
      .setDesc('微信内容同步进来存放的文件夹')
      .addText((t) =>
        t.setPlaceholder('微信收藏').setValue(this.plugin.settings.inboxFolder).onChange(async (v) => {
          this.plugin.settings.inboxFolder = v.trim();
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('按标题自动互链')
      .setDesc('导入时把正文中出现的其他笔记标题替换为 [[双链]]')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoLinkByTitle).onChange(async (v) => {
          this.plugin.settings.autoLinkByTitle = v;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('附件文件夹')
      .setDesc('微信图片 / PDF / 文件下载进 vault 的目录（留空则自动用「收藏文件夹/附件」）')
      .addText((t) =>
        t
          .setPlaceholder('微信收藏/附件')
          .setValue(this.plugin.settings.attachmentsFolder)
          .onChange(async (v) => {
            this.plugin.settings.attachmentsFolder = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName('AI 对话').setHeading();
    new Setting(containerEl)
      .setName('API Base URL')
      .setDesc('OpenAI 兼容接口地址')
      .addText((t) =>
        t.setPlaceholder('https://api.openai.com/v1').setValue(this.plugin.settings.aiBaseUrl).onChange(async (v) => {
          this.plugin.settings.aiBaseUrl = v.trim();
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('API Key')
      .addText((t) =>
        t.setPlaceholder('sk-...').setValue(this.plugin.settings.aiApiKey).onChange(async (v) => {
          this.plugin.settings.aiApiKey = v.trim();
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('模型')
      .addText((t) =>
        t.setPlaceholder('gpt-4o-mini').setValue(this.plugin.settings.aiModel).onChange(async (v) => {
          this.plugin.settings.aiModel = v.trim();
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('对话文件夹')
      .setDesc('每次对话自动存档到的文件夹')
      .addText((t) =>
        t.setPlaceholder('AI对话').setValue(this.plugin.settings.conversationFolder).onChange(async (v) => {
          this.plugin.settings.conversationFolder = v.trim();
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('续接上次对话')
      .setDesc('打开对话视图时自动加载最近的对话文档，接着聊')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.resumeLastConversation).onChange(async (v) => {
          this.plugin.settings.resumeLastConversation = v;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('系统提示词')
      .addTextArea((t) =>
        t.setValue(this.plugin.settings.systemPrompt).onChange(async (v) => {
          this.plugin.settings.systemPrompt = v;
          await this.plugin.saveSettings();
        })
      );
  }

  // 列出本设备的所有绑定入口（绑定码），支持单独移除
  private async loadEntries(container: HTMLElement): Promise<void> {
    try {
      const codes = await this.plugin.getApi().listDeviceCodes();
      if (!codes.length) return;
      container.createEl('h4', { text: `已绑定入口（${codes.length}）`, cls: 'sync-entries-title' });
      for (const c of codes) {
        const row = container.createEl('div', { cls: 'sync-entry-row' });
        row.createEl('span', { text: c.code, cls: 'sync-entry-code' });
        row.createEl('span', {
          text: c.boundAt ? '已激活' : '未激活',
          cls: c.boundAt ? 'sync-entry-on' : 'sync-entry-off',
        });
        const btn = row.createEl('button', { text: '移除' });
        btn.addEventListener('click', async () => {
          await this.plugin.revokeCode(c.code);
          this.display();
        });
      }
    } catch {
      // 旧版后端不支持多入口接口时静默跳过，不影响其余设置
    }
  }
}
