import { requestUrl } from 'obsidian';
import type { BindDeviceInput, BindDeviceResponse, CreateNoteInput, InboxItem, PublishedNote } from './types';

// 后端 API 客户端，全部走 Obsidian 内置 requestUrl（免 CORS、移动端可用）
// 鉴权方式：绑定码配对后获得 deviceToken，后续请求带在 x-device-token 头中
export class SyncApi {
  constructor(public baseUrl: string, public deviceToken: string) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = this.baseUrl.replace(/\/+$/, '') + path;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.deviceToken) {
      headers['x-device-token'] = this.deviceToken;
    }
    const resp = await requestUrl({
      url,
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (resp.status >= 400) {
      const text = typeof resp.text === 'string' ? resp.text : JSON.stringify(resp.json || {});
      throw new Error(`后端错误 ${resp.status}: ${text}`);
    }
    return resp.json as T;
  }

  bindDevice(input: BindDeviceInput): Promise<BindDeviceResponse> {
    return this.req<BindDeviceResponse>('POST', '/api/devices/bind', input);
  }

  listInbox(pendingOnly = true): Promise<InboxItem[]> {
    return this.req<InboxItem[]>('GET', `/api/inbox?pendingOnly=${pendingOnly}`);
  }

  getInboxItem(id: string): Promise<InboxItem> {
    return this.req<InboxItem>('GET', `/api/inbox/${encodeURIComponent(id)}`);
  }

  markInboxSynced(id: string, obsidianPath: string): Promise<InboxItem> {
    return this.req<InboxItem>('POST', `/api/inbox/${encodeURIComponent(id)}/synced`, { obsidianPath });
  }

  pushNote(note: CreateNoteInput): Promise<PublishedNote> {
    return this.req<PublishedNote>('POST', '/api/notes', note);
  }

  listNotes(): Promise<PublishedNote[]> {
    return this.req<PublishedNote[]>('GET', '/api/notes');
  }
}
