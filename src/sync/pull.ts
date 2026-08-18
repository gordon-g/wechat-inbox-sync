import { Notice, TFile } from 'obsidian';
import type WechatSyncPlugin from '../main';
import { SyncApi } from '../api';
import type { InboxItem } from '../types';
import { buildFrontmatter, ensureFolder, sanitizeFilename } from '../utils/markdown';
import { injectTitleLinks, updateTagHubs } from './links';

// 把一条微信内容渲染成笔记正文（含 frontmatter + 标签双链脚注）
function buildNoteContent(item: InboxItem): string {
  const fm = buildFrontmatter({
    type: item.type,
    source: item.source || 'Obsidian 内容同步助手',
    url: item.url || '',
    tags: item.tags,
    wechat_id: item.id,
    importedAt: new Date().toISOString(),
  });
  const media = (item.mediaUrls || []).map((u) => `![](${u})`).join('\n');
  const related =
    item.tags.length > 0
      ? '\n## 关联\n' + item.tags.map((t) => `- [[索引/${t}]]`).join('\n') + '\n'
      : '';
  return `${fm}\n# ${item.title}\n\n${item.content}\n\n${media}\n${related}`;
}

// 在本批次导入的笔记之间互链（按标题命中）
async function linkWithinBatch(plugin: WechatSyncPlugin, titles: string[]): Promise<void> {
  if (titles.length < 2 || !plugin.settings.autoLinkByTitle) return;
  const folder = plugin.settings.inboxFolder;
  for (const title of titles) {
    const path = `${folder}/${sanitizeFilename(title)}.md`;
    const file = plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) continue;
    const content = await plugin.app.vault.cachedRead(file);
    const others = titles.filter((t) => t !== title);
    const linked = injectTitleLinks(content, others);
    if (linked !== content) {
      await plugin.app.vault.modify(file, linked);
    }
  }
}

// 拉取后端待同步项 → 生成双链笔记 → 标记已同步
export async function pullPending(plugin: WechatSyncPlugin): Promise<number> {
  const api: SyncApi = plugin.getApi();
  const settings = plugin.settings;
  let items: InboxItem[] = [];
  try {
    items = await api.listInbox(true);
  } catch (e) {
    new Notice('拉取失败：' + (e as Error).message);
    return 0;
  }
  if (items.length === 0) {
    new Notice('没有待同步的微信内容');
    return 0;
  }

  await ensureFolder(plugin.app.vault, settings.inboxFolder);

  const importedTitles: string[] = [];
  const imported: { title: string; tags: string[] }[] = [];

  for (const item of items) {
    const safe = sanitizeFilename(item.title);
    const path = `${settings.inboxFolder}/${safe}.md`;
    const existing = plugin.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      // 已存在则跳过，不覆盖用户可能已做的编辑
      await api.markInboxSynced(item.id, path);
      continue;
    }
    await plugin.app.vault.create(path, buildNoteContent(item));
    importedTitles.push(item.title);
    imported.push({ title: item.title, tags: item.tags });
    await api.markInboxSynced(item.id, path);
  }

  await linkWithinBatch(plugin, importedTitles);
  await updateTagHubs(plugin.app, imported, `${settings.inboxFolder}/索引`);

  new Notice(`已同步 ${importedTitles.length} 条到「${settings.inboxFolder}」`);
  return importedTitles.length;
}
