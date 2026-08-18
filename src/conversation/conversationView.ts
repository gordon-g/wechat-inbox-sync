import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type WechatSyncPlugin from '../main';
import { chatCompletion, ChatMessage } from './aiClient';
import {
  appendTurn,
  createConversationFile,
  findLatestConversation,
  loadTranscript,
} from './store';

export const VIEW_TYPE_CONVERSATION = 'wechat-inbox-sync-conversation';

export class ConversationView extends ItemView {
  private plugin: WechatSyncPlugin;
  private messages: ChatMessage[] = [];
  private file: TFile | null = null;
  private logEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private busy = false;

  constructor(leaf: WorkspaceLeaf, plugin: WechatSyncPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CONVERSATION;
  }
  getDisplayText(): string {
    return 'AI 对话';
  }
  getIcon(): string {
    return 'message-square';
  }

  async onOpen(): Promise<void> {
    const settings = this.plugin.settings;
    const state = this.leaf.getViewState().state as { forceNew?: boolean } | undefined;
    const forceNew = state?.forceNew === true;

    if (forceNew || !settings.resumeLastConversation) {
      this.file = await createConversationFile(this.app, settings.conversationFolder);
    } else {
      const latest = await findLatestConversation(this.app, settings.conversationFolder);
      if (latest) {
        this.file = latest;
        this.messages = loadTranscript(await this.app.vault.cachedRead(latest));
      } else {
        this.file = await createConversationFile(this.app, settings.conversationFolder);
      }
    }

    this.render();
    for (const m of this.messages) {
      this.renderMessage(m.role, m.content);
    }
    this.scrollToBottom();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('ws-conversation');

    const header = root.createEl('div', { cls: 'ws-conv-header' });
    header.textContent = this.file
      ? `对话文档：${this.file.path}（自动存档）`
      : 'AI 对话';

    this.logEl = root.createEl('div', { cls: 'ws-conv-log' });

    const inputRow = root.createEl('div', { cls: 'ws-conv-input' });
    this.inputEl = inputRow.createEl('textarea', {
      cls: 'ws-conv-textarea',
      attr: { placeholder: '输入消息，Enter 发送，Shift+Enter 换行' },
    });
    this.sendBtn = inputRow.createEl('button', { text: '发送' });
    this.sendBtn.addEventListener('click', () => this.send());

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });
  }

  private renderMessage(role: ChatMessage['role'], text: string): void {
    const wrap = this.logEl.createEl('div', {
      cls: `ws-msg ${role === 'user' ? 'ws-msg-user' : 'ws-msg-assistant'}`,
    });
    wrap.createEl('div', {
      cls: 'ws-msg-role',
      text: role === 'user' ? '我' : '助手',
    });
    wrap.createEl('div', { text });
  }

  private scrollToBottom(): void {
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private async send(): Promise<void> {
    if (this.busy) return;
    const text = this.inputEl.value.trim();
    if (!text) return;
    if (!this.plugin.settings.aiApiKey) {
      new Notice('请先在插件设置里填写 AI API Key');
      return;
    }
    this.inputEl.value = '';
    await this.addMessage('user', text);

    this.busy = true;
    this.sendBtn.disabled = true;
    this.sendBtn.setText('生成中…');
    try {
      const settings = this.plugin.settings;
      const messages: ChatMessage[] = [
        { role: 'system', content: settings.systemPrompt },
        ...this.messages,
      ];
      const reply = await chatCompletion({
        baseUrl: settings.aiBaseUrl,
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
        messages,
      });
      await this.addMessage('assistant', reply);
    } catch (e) {
      new Notice('AI 出错：' + (e as Error).message);
    } finally {
      this.busy = false;
      this.sendBtn.disabled = false;
      this.sendBtn.setText('发送');
    }
  }

  private async addMessage(role: 'user' | 'assistant', text: string): Promise<void> {
    this.messages.push({ role, content: text });
    this.renderMessage(role, text);
    this.scrollToBottom();
    if (this.file) {
      await appendTurn(this.app, this.file, role, text);
    }
  }
}
