import { requestUrl } from 'obsidian';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 调用 OpenAI 兼容的聊天接口（非流式，MVP 够用）
export async function chatCompletion(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}): Promise<string> {
  const url = opts.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const resp = await requestUrl({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: 0.7,
    }),
  });
  if (resp.status >= 400) {
    throw new Error(`AI 错误 ${resp.status}: ${resp.text || ''}`);
  }
  const data = resp.json as { choices?: { message?: { content?: string } }[] };
  return data?.choices?.[0]?.message?.content ?? '';
}
