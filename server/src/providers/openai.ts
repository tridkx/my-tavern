import type { ChatCompletionMessage, ChatCompletionRequest, Connection } from '../types.js';
import { resolveApiKey } from './presets.js';
import { ALLOW_PRIVATE_BASE_URLS, OUTBOUND_TIMEOUT_MS } from '../config.js';
import { assertPublicHost } from '../net.js';

/** 可选 SSRF 防护：默认关闭，开启时校验 base_url 的 host 非私网地址。 */
async function assertBaseUrlAllowed(baseUrl: string) {
  if (ALLOW_PRIVATE_BASE_URLS) return;
  const u = new URL(baseUrl);
  await assertPublicHost(u.hostname);
}

/** 给请求叠加超时（与调用方的 abort signal 合并）。 */
function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(OUTBOUND_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function endpoint(baseUrl: string, path: string): string {
  const base = (baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('未配置 API 地址 base_url');
  if (base.endsWith(path)) return base;
  if (base.endsWith('/v1')) return `${base}${path}`;
  if (base.endsWith('/v1/')) return `${base}${path}`;
  return `${base}/v1${path}`;
}

function headers(connection: Connection): Record<string, string> {
  const apiKey = resolveApiKey(connection);
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(connection.extra_headers || {}),
  };
  return h;
}

function buildBody(connection: Connection, messages: ChatCompletionMessage[], opts: Partial<ChatCompletionRequest> = {}): ChatCompletionRequest {
  return {
    model: opts.model || connection.model,
    messages,
    temperature: opts.temperature ?? connection.temperature,
    top_p: opts.top_p ?? connection.top_p,
    ...(connection.top_k ? { top_k: connection.top_k } : {}),
    frequency_penalty: opts.frequency_penalty ?? connection.frequency_penalty,
    presence_penalty: opts.presence_penalty ?? connection.presence_penalty,
    max_tokens: opts.max_tokens ?? connection.max_tokens,
    stop: opts.stop || connection.stop_sequences,
    stream: opts.stream ?? false,
  };
}

/**
 * 非流式调用 OpenAI 兼容 chat/completions。
 */
export async function completeChat(
  connection: Connection,
  messages: ChatCompletionMessage[],
  opts: Partial<ChatCompletionRequest> = {},
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(endpoint(connection.base_url, '/chat/completions'), {
    method: 'POST',
    headers: headers(connection),
    body: JSON.stringify(buildBody(connection, messages, { ...opts, stream: false })),
    signal: withTimeout(signal),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`模型请求失败 ${res.status}: ${text.slice(0, 500)}`);
  }
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

/**
 * 流式调用 OpenAI 兼容 chat/completions，逐段 yield 文本增量。
 */
export async function* streamChat(
  connection: Connection,
  messages: ChatCompletionMessage[],
  opts: Partial<ChatCompletionRequest> = {},
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(endpoint(connection.base_url, '/chat/completions'), {
    method: 'POST',
    headers: headers(connection),
    body: JSON.stringify(buildBody(connection, messages, { ...opts, stream: true })),
    signal: withTimeout(signal),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`模型请求失败 ${res.status}: ${text.slice(0, 500)}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('模型响应没有可读流');

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) yield delta;
      } catch {
        // 忽略无法解析的 SSE 行
      }
    }
  }
}

/**
 * OpenAI 兼容图片生成。
 */
export async function generateImage(
  connection: Connection,
  prompt: string,
  opts: { size?: string; n?: number; response_format?: 'url' | 'b64_json' } = {},
): Promise<{ url?: string; b64_json?: string; revised_prompt?: string }[]> {
  const apiKey = resolveApiKey(connection);
  await assertBaseUrlAllowed(connection.base_url);
  const body: Record<string, unknown> = {
    model: connection.model,
    prompt,
    n: opts.n ?? 1,
    size: opts.size || '1024x1024',
    response_format: opts.response_format || 'url',
  };
  const res = await fetch(endpoint(connection.base_url, '/images/generations'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(connection.extra_headers || {}),
    },
    body: JSON.stringify(body),
    signal: withTimeout(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`图片生成失败 ${res.status}: ${text.slice(0, 500)}`);
  }
  const data: any = await res.json();
  return data?.data ?? [];
}

/**
 * OpenAI 兼容 TTS。返回音频 buffer。
 */
export async function generateSpeech(
  connection: Connection,
  text: string,
  opts: { voice?: string; speed?: number; response_format?: string } = {},
): Promise<Buffer> {
  const apiKey = resolveApiKey(connection);
  await assertBaseUrlAllowed(connection.base_url);
  const body: Record<string, unknown> = {
    model: connection.model,
    input: text,
    voice: opts.voice || 'alloy',
    speed: opts.speed ?? 1,
    response_format: opts.response_format || 'mp3',
  };
  const res = await fetch(endpoint(connection.base_url, '/audio/speech'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(connection.extra_headers || {}),
    },
    body: JSON.stringify(body),
    signal: withTimeout(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`语音生成失败 ${res.status}: ${text.slice(0, 500)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
