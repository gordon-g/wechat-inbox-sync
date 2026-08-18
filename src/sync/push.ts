import { MarkdownView, Notice } from 'obsidian';
import type WechatSyncPlugin from '../main';
import { getFrontmatterTags } from '../utils/markdown';

// 把当前打开的笔记推送到后端，供小程序展示
export async function pushActiveNote(plugin: WechatSyncPlugin): Promise<void> {
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  const file = view?.file;
  if (!file) {
    new Notice('请先打开一篇要发布的笔记');
    return;
  }
  const content = await plugin.app.vault.cachedRead(file);
  const cache = plugin.app.metadataCache.getFileCache(file);
  const tags = getFrontmatterTags(file, cache as { frontmatter?: { tags?: unknown } } | null);

  try {
    await plugin.getApi().pushNote({ title: file.basename, content, tags });
    new Notice(`已发布「${file.basename}」到小程序`);
  } catch (e) {
    new Notice('发布失败：' + (e as Error).message);
  }
}
