import { App, TFile } from 'obsidian';
import { buildFrontmatter, ensureFolder } from '../utils/markdown';
import type { ChatMessage } from './aiClient';

const PREFIX = '对话-';

function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}`
  );
}

// 找到当前文件夹里最新（按文件名排序）的对话文档
export async function findLatestConversation(app: App, folder: string): Promise<TFile | null> {
  const files = app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith(folder + '/') && f.basename.startsWith(PREFIX));
  if (files.length === 0) return null;
  files.sort((a, b) => b.basename.localeCompare(a.basename));
  return files[0];
}

// 新建一个对话文档，返回 TFile
export async function createConversationFile(app: App, folder: string): Promise<TFile> {
  await ensureFolder(app.vault, folder);
  const stamp = formatStamp(new Date());
  const path = `${folder}/${PREFIX}${stamp}.md`;
  const fm = buildFrontmatter({
    conversationId: stamp,
    createdAt: new Date().toISOString(),
    type: 'conversation',
  });
  return app.vault.create(path, `${fm}\n# 对话 ${stamp}\n`);
}

// 把一轮对话追加写入文档（用户/助手各一个二级标题块）
export async function appendTurn(
  app: App,
  file: TFile,
  role: 'user' | 'assistant',
  text: string
): Promise<void> {
  const existing = await app.vault.cachedRead(file);
  const header = role === 'user' ? '## 👤 用户' : '## 🤖 助手';
  const updated = `${existing}\n\n${header}\n\n${text}\n`;
  await app.vault.modify(file, updated);
}

// 从文档正文解析出历史消息，用于续接上下文
export function loadTranscript(content: string): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  const matches = [...content.matchAll(/##\s*(?:👤\s*)?用户|##\s*(?:🤖\s*)?助手/g)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const role: 'user' | 'assistant' = m[0].includes('用户') ? 'user' : 'assistant';
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? content.length : content.length;
    const text = content.slice(start, end).trim();
    if (text) msgs.push({ role, content: text });
  }
  return msgs;
}
