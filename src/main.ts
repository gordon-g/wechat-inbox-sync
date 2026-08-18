import { MarkdownView, Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { WechatSyncSettingTab, DEFAULT_SETTINGS, WechatSyncSettings } from './settings';
import { SyncApi } from './api';
import { pullPending } from './sync/pull';
import { pushActiveNote } from './sync/push';
import { updateTagHubs } from './sync/links';
import { getFrontmatterTags } from './utils/markdown';
import { ConversationView, VIEW_TYPE_CONVERSATION } from './conversation/conversationView';

function generateDeviceId(): string {
  return 'obs-' + Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

export default class WechatSyncPlugin extends Plugin {
  settings!: WechatSyncSettings;
  private api!: SyncApi;
  private statusBarItem!: HTMLElement;
  private syncIntervalId: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // 保证本机有唯一 deviceId
    if (!this.settings.deviceId) {
      this.settings.deviceId = generateDeviceId();
      await this.saveSettings();
    }

    this.api = new SyncApi(this.settings.backendUrl, this.settings.deviceToken);
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar('就绪');

    this.addRibbonIcon('refresh-cw', '同步微信内容', () => this.syncNow());

    this.addCommand({
      id: 'pull-wechat',
      name: '拉取微信内容到知识库',
      callback: () => this.syncNow(),
    });
    this.addCommand({
      id: 'push-note',
      name: '发布当前笔记到小程序',
      callback: () => this.pushNow(),
    });
    this.addCommand({
      id: 'open-conversation',
      name: '打开 AI 对话（续接上次）',
      callback: () => this.activateConversation(false),
    });
    this.addCommand({
      id: 'new-conversation',
      name: '新建对话',
      callback: () => this.activateConversation(true),
    });
    this.addCommand({
      id: 'rebuild-links',
      name: '重建双链索引',
      callback: () => this.rebuildLinks(),
    });

    this.registerView(VIEW_TYPE_CONVERSATION, (leaf: WorkspaceLeaf) => new ConversationView(leaf, this));
    this.addSettingTab(new WechatSyncSettingTab(this.app, this));

    // 布局就绪后：自动同步 + 启动轮询
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.autoSyncOnStartup && this.settings.deviceToken) {
        this.syncNow(false);
      }
      this.restartSyncInterval();
    });
  }

  onunload(): void {
    if (this.syncIntervalId) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  // 始终返回带最新设置的 API 客户端
  getApi(): SyncApi {
    this.api.baseUrl = this.settings.backendUrl;
    this.api.deviceToken = this.settings.deviceToken;
    return this.api;
  }

  private updateStatusBar(text: string): void {
    if (this.statusBarItem) {
      this.statusBarItem.setText(`微信同步: ${text}`);
    }
  }

  // 绑定码配对
  async bindWithCode(code: string): Promise<void> {
    code = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      new Notice('绑定码应为 6 位字母/数字');
      return;
    }
    try {
      this.updateStatusBar('绑定中...');
      const resp = await this.getApi().bindDevice({
        code,
        deviceId: this.settings.deviceId,
        name: this.settings.deviceName,
      });
      this.settings.deviceToken = resp.deviceToken;
      this.settings.pairingCodeInput = '';
      await this.saveSettings();
      new Notice(`✅ 绑定成功：${resp.name}`);
      this.updateStatusBar('已绑定');
      await this.syncNow(false);
    } catch (e) {
      this.updateStatusBar('绑定失败');
      new Notice('绑定失败：' + (e as Error).message);
    }
  }

  unbindDevice(): void {
    this.settings.deviceToken = '';
    this.saveSettings();
    new Notice('已解除绑定');
    this.updateStatusBar('未绑定');
  }

  // 拉取同步
  async syncNow(notifyEmpty = true): Promise<number> {
    if (!this.settings.deviceToken) {
      if (notifyEmpty) new Notice('尚未绑定 Obsidian，请在插件设置输入小程序绑定码');
      this.updateStatusBar('未绑定');
      return 0;
    }
    this.updateStatusBar('同步中...');
    try {
      const count = await pullPending(this);
      const time = new Date().toLocaleTimeString();
      this.updateStatusBar(count > 0 ? `已同步 ${count} 条 (${time})` : `已同步 (${time})`);
      return count;
    } catch (e) {
      this.updateStatusBar('同步失败');
      if (notifyEmpty) new Notice('同步失败：' + (e as Error).message);
      return 0;
    }
  }

  private async pushNow(): Promise<void> {
    if (!this.settings.deviceToken) {
      new Notice('尚未绑定 Obsidian，无法发布到小程序');
      return;
    }
    try {
      await pushActiveNote(this);
    } catch (e) {
      new Notice('发布失败：' + (e as Error).message);
    }
  }

  private async activateConversation(forceNew: boolean): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf('tab');
    await leaf.setViewState({
      type: VIEW_TYPE_CONVERSATION,
      active: true,
      state: { forceNew },
    });
  }

  private async rebuildLinks(): Promise<void> {
    const folder = this.settings.inboxFolder;
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.startsWith(folder + '/'));
    const items = files.map((f) => ({
      title: f.basename,
      tags: getFrontmatterTags(f, this.app.metadataCache.getFileCache(f) as { frontmatter?: { tags?: unknown } } | null),
    }));
    await updateTagHubs(this.app, items, `${folder}/索引`);
    new Notice(`已重建双链索引（${items.length} 篇）`);
  }

  restartSyncInterval(): void {
    if (this.syncIntervalId) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    const minutes = this.settings.syncIntervalMinutes;
    if (minutes > 0 && this.settings.deviceToken) {
      this.syncIntervalId = window.setInterval(() => this.syncNow(false), minutes * 60 * 1000);
    }
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<WechatSyncSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.restartSyncInterval();
  }
}
