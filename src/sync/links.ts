import { App, TFile } from 'obsidian';
import { ensureFolder, sanitizeFilename } from '../utils/markdown';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 在正文中把出现的其他笔记标题替换为 [[标题]]，建立双链
// 仅在整词（前后非单词字符）匹配时替换，避免误伤
export function injectTitleLinks(content: string, titles: string[]): string {
  let out = content;
  for (const t of titles) {
    if (t.length < 2) continue;
    const re = new RegExp(`(?<!\\w)(?<!\[\[)${escapeRegExp(t)}(?!\\w)(?!\]\])`, 'g');
    out = out.replace(re, `[[${t}]]`);
  }
  return out;
}

// 维护标签 Hub 笔记：索引/<标签>.md 链接所有带该标签的笔记
// 同时每个笔记底部也链接回自己的标签 Hub —— 形成天然双向链接
export async function updateTagHubs(
  app: App,
  items: { title: string; tags: string[] }[],
  indexFolder: string
): Promise<void> {
  const byTag = new Map<string, string[]>();
  for (const it of items) {
    for (const tag of it.tags) {
      const arr = byTag.get(tag) || [];
      arr.push(it.title);
      byTag.set(tag, arr);
    }
  }
  if (byTag.size === 0) return;
  await ensureFolder(app.vault, indexFolder);
  for (const [tag, titles] of byTag) {
    const path = `${indexFolder}/${sanitizeFilename(tag)}.md`;
    const body =
      `# ${tag}\n\n` +
      '> 自动维护的标签索引，下面的笔记都打了 `' +
      tag +
      '` 标签。\n\n' +
      titles.map((t) => `- [[${t}]]`).join('\n') +
      '\n';
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await app.vault.modify(existing, body);
    } else {
      await app.vault.create(path, body);
    }
  }
}
