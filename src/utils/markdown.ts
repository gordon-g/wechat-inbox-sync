import { TFile, Vault } from 'obsidian';

// 清理成合法文件名
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|#^[\]]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || '未命名'
  );
}

// 递归创建文件夹（Obsidian 不会自动建父目录）
export async function ensureFolder(vault: Vault, folderPath: string): Promise<void> {
  if (!folderPath || folderPath === '/') return;
  const parts = folderPath.split('/').filter(Boolean);
  let cur = '';
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p;
    if (!vault.getAbstractFileByPath(cur)) {
      await vault.createFolder(cur);
    }
  }
}

// 生成 YAML frontmatter 文本
export function buildFrontmatter(fm: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      const items = v.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(', ');
      lines.push(`${k}: [${items}]`);
    } else if (typeof v === 'string') {
      lines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    } else if (v === null || v === undefined) {
      lines.push(`${k}: ""`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// 取笔记 frontmatter 里的 tags
export function getFrontmatterTags(file: TFile, cache: { frontmatter?: { tags?: unknown } } | null): string[] {
  const t = cache?.frontmatter?.tags;
  if (Array.isArray(t)) return t as string[];
  if (typeof t === 'string') return [t];
  return [];
}
