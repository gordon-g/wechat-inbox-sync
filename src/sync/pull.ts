import { Notice, TFile, requestUrl } from 'obsidian';
import type WechatSyncPlugin from '../main';
import { SyncApi } from '../api';
import type { InboxItem } from '../types';
import { buildFrontmatter, ensureFolder, sanitizeFilename } from '../utils/markdown';
import { injectTitleLinks, updateTagHubs } from './links';

// 把一条微信内容渲染成笔记正文（含 frontmatter + 标签双链脚注）
// urlToRef：远端媒体 URL -> 本地 ![[...]] 引用的映射，用于把正文里的远程 ![](url) 改写为本地附件
// mediaRefs：本条所有媒体的本地引用（已注入正文的会被去重，避免重复）
function buildNoteContent(
  item: InboxItem,
  urlToRef: Record<string, string>,
  mediaRefs: string[]
): string {
  const fm = buildFrontmatter({
    type: item.type,
    source: item.source || 'Obsidian 内容同步助手',
    url: item.url || '',
    tags: item.tags,
    wechat_id: item.id,
    importedAt: new Date().toISOString(),
  });

  // 把正文中远程 ![](url) 替换为本地引用（小程序会把图片以 ![](url) 形式写进正文）
  let body = item.content || '';
  const injected = new Set<string>();
  for (const [u, ref] of Object.entries(urlToRef)) {
    const token = `![](${u})`;
    if (body.includes(token)) {
      body = body.split(token).join(ref);
      injected.add(ref);
    }
  }

  // 媒体块：仅列出未在正文中出现的引用（图片已嵌入正文则不再重复）
  const media = mediaRefs.filter((r) => !injected.has(r)).join('\n');

  const related =
    item.tags.length > 0
      ? '\n## 关联\n' + item.tags.map((t) => `- [[索引/${t}]]`).join('\n') + '\n'
      : '';
  return `${fm}\n# ${item.title}\n\n${body}\n\n${media}\n${related}`;
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

// 根据 URL 文件名或 Content-Type 推断扩展名
function extFor(urlBase: string, contentType: string): string {
  const m = urlBase.match(/\.([a-z0-9]+)$/i);
  if (m) {
    const e = '.' + m[1].toLowerCase();
    if (e.length <= 6) return e; // 防异常长后缀
  }
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/zip': '.zip',
    'text/plain': '.txt',
    'text/markdown': '.md',
  };
  return map[contentType] || '';
}

// 把一条远程媒体下载进 vault 附件目录，返回本地 ![[文件名]] 引用。
// 幂等：同名文件已存在则直接复用，避免重复下载 / 重复文件。
// 失败返回 null（调用方退回远程 ![](url) 链接，至少图片仍可显示）。
async function downloadMediaToVault(
  plugin: WechatSyncPlugin,
  url: string,
  attachFolder: string
): Promise<string | null> {
  try {
    const resp = await requestUrl({ url, method: 'GET' });
    if (resp.status >= 400) return null;
    const buf = resp.arrayBuffer;
    if (!buf || buf.byteLength === 0) return null;

    const contentType = ((resp.headers && resp.headers['content-type']) || '').split(';')[0].trim().toLowerCase();
    const urlBase = decodeURIComponent(String(url).split('?')[0].split('#')[0]);
    const rawName = urlBase.split('/').pop() || 'attachment';
    let stem = (rawName.replace(/\.[^.]+$/, '') || 'attachment');
    const ext = extFor(urlBase, contentType);
    stem = sanitizeFilename(stem).slice(0, 50);
    const fname = `${stem}${ext}`;
    const targetPath = `${attachFolder}/${fname}`;

    const existing = plugin.app.vault.getAbstractFileByPath(targetPath);
    if (existing instanceof TFile) {
      // 已下载过：复用，不发第二次网络请求
      return `![[${fname}]]`;
    }
    await plugin.app.vault.createBinary(targetPath, buf);
    return `![[${fname}]]`;
  } catch (e) {
    console.error('[wechat-sync] 下载媒体失败:', url, e);
    return null;
  }
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

// 拉取后端待同步项 → 下载媒体附件 → 生成双链笔记 → 标记已同步
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
  const attachFolder = settings.attachmentsFolder || `${settings.inboxFolder}/附件`;
  await ensureFolder(plugin.app.vault, attachFolder);

  const importedTitles: string[] = [];
  const imported: { title: string; tags: string[] }[] = [];

  for (const item of items) {
    // 1) 先把所有媒体下载进 vault 附件目录，建立 url -> 本地引用
    const urlToRef: Record<string, string> = {};
    const mediaRefs: string[] = [];
    if (item.mediaUrls && item.mediaUrls.length) {
      for (const u of item.mediaUrls) {
        const ref = await downloadMediaToVault(plugin, u, attachFolder);
        const finalRef = ref ?? `![](${u})`; // 下载失败退回远程链接
        urlToRef[u] = finalRef;
        mediaRefs.push(finalRef);
      }
    }

    const noteContent = buildNoteContent(item, urlToRef, mediaRefs);
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
      // 旧空白笔记：用后端真实内容（含本地附件引用）覆盖回填
      await plugin.app.vault.modify(existing, noteContent);
    } else {
      await plugin.app.vault.create(path, noteContent);
    }
    importedTitles.push(item.title);
    imported.push({ title: item.title, tags: item.tags });
    await api.markInboxSynced(item.id, path);
  }

  await linkWithinBatch(plugin, importedTitles);
  await updateTagHubs(plugin.app, imported, `${settings.inboxFolder}/索引`);

  new Notice(`已同步 ${importedTitles.length} 条到「${settings.inboxFolder}」`);
  return importedTitles.length;
}
