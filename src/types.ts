export type InboxItemType = 'article' | 'image' | 'video' | 'text' | 'audio' | 'file';

export interface InboxItem {
  id: string;
  deviceId: string;
  type: InboxItemType;
  title: string;
  url?: string;
  content: string;
  mediaUrls?: string[];
  source?: string;
  tags: string[];
  createdAt: number;
  syncedToObsidian: boolean;
  obsidianPath?: string;
}

export interface PublishedNote {
  id: string;
  deviceId: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface BindDeviceInput {
  code: string;
  deviceId: string;
  name?: string;
}

export interface BindDeviceResponse {
  deviceToken: string;
  name: string;
  boundAt: number;
}

export interface CreateNoteInput {
  title: string;
  content: string;
  tags?: string[];
}
