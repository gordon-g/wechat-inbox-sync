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

// 判断一条已存在的笔记是否为「空白笔记」（仅 frontmatter/标题/嵌入，无实质正文）
function isBlankNote(content: string): boolean {
  let c = content;
  c = c.replace(/^---\n[\s\S]*?\n---\n?/, ''); // 去 frontmatter
  c = c.replace(/^#\s.*\n?/, ''); // 去一级标题
  c = c.replace(/!\[\[.*?\]\]/g, '').replace(/!\[.*?\]\(.*?\)/g, ''); // 去嵌入/图片
  c = c.replace(/^##\s*关联[\s\S]*$/m, ''); // 去关联区块
  c = c.replace(/\n{2,}/g, '\n').trim();
  return c.replace(/\s/g, '').length === 0;
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
export async function pullPending(plugin: WechatSyncPlugin, pendingOnly = true): Promise<number> {
  const api: SyncApi = plugin.getApi();
  const settings = plugin.settings;
  let items: InboxItem[] = [];
  try {
    items = await api.listInbox(pendingOnly);
  } catch (e) {
    new Notice('拉取失败：' + (e as Error).message);
    return 0;
  }
  if (items.length === 0) {
    new Notice(pendingOnly ? '没有待同步的微信内容' : '没有可拉取的微信内容');
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
      const current = await plugin.app.vault.read(existing);
      if (!isBlankNote(current)) {
        // 已存在且非空：保留用户编辑，仅标记已同步
        await api.markInboxSynced(item.id, path);
        continue;
      }
      // 旧空白笔记：用后端真实内容覆盖回填
      await plugin.app.vault.modify(existing, buildNoteContent(item));
      importedTitles.push(item.title);
      imported.push({ title: item.title, tags: item.tags });
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
