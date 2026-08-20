import type { ChatCompletionMessage, ChatCompletionRequest, Connection } from '../types.js';
import { resolveApiKey } from './presets.js';
import { ALLOW_PRIVATE_BASE_URLS, OUTBOUND_TIMEOUT_MS } from '../config.js';
import { assertPublicHost } from '../net.js';

/** 可选 SSRF 防护：默认关闭，开启时校验 base_url 的 host 非私网地址。 */
export async function assertBaseUrlAllowed(baseUrl: string) {
  if (ALLOW_PRIVATE_BASE_URLS) return;
  const u = new URL(baseUrl);
  await assertPublicHost(u.hostname);
}

/** 给请求叠加超时（与调用方的 abort signal 合并）。 */
export function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(OUTBOUND_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * 带 SSRF 防护的 fetch：
 * - 每次请求（包括重定向后的地址）都校验目标 host 非私网/环回；
 * - 手动处理重定向，避免“公网 302 到内网”绕过。
 */
export async function safeFetch(url: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<Response> {
  let currentUrl = url;
  let redirects = 0;
  for (;;) {
    await assertBaseUrlAllowed(currentUrl);
    const res = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
      signal: withTimeout(init.signal),
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) return res;
      currentUrl = new URL(location, currentUrl).toString();
      redirects += 1;
      if (redirects > 5) throw new Error('模型请求重定向过多');
      continue;
    }
    return res;
  }
}

function endpoint(baseUrl: string, path: string): string {
  const base = (baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('未配置 API 地址 base_url');
  if (base.endsWith(path)) return base;
  // 已是版本化端点（/v1 /v2 /v3 ...）则直接拼接，避免 api/v3 被拼成 api/v3/v1
  if (/\/v\d+$/.test(base)) return `${base}${path}`;
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
  const res = await safeFetch(endpoint(connection.base_url, '/chat/completions'), {
    method: 'POST',
    headers: headers(connection),
    body: JSON.stringify(buildBody(connection, messages, { ...opts, stream: false })),
    signal,
  });
  if (!res.ok) {
    throw new Error(`模型请求失败 ${res.status}`);
  }
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

/**
 * 流式响应末尾的 usage 统计（各家字段命名不同，统一保留原始字段由前端归一化）。
 * DeepSeek: prompt_cache_hit_tokens / prompt_cache_miss_tokens
 * OpenAI:   cached_tokens（在 prompt_tokens_details 内）
 */
export interface StreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  cached_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

/**
 * 流式调用 OpenAI 兼容 chat/completions，逐段 yield 文本增量。
 * 流末尾的 usage chunk（含缓存命中统计）通过 onUsage 回调上报，调用方可在 done 事件中携带。
 */
export async function* streamChat(
  connection: Connection,
  messages: ChatCompletionMessage[],
  opts: Partial<ChatCompletionRequest> = {},
  signal?: AbortSignal,
  onUsage?: (usage: StreamUsage) => void,
): AsyncGenerator<string> {
  const res = await safeFetch(endpoint(connection.base_url, '/chat/completions'), {
    method: 'POST',
    headers: headers(connection),
    body: JSON.stringify(buildBody(connection, messages, { ...opts, stream: true })),
    signal,
  });
  if (!res.ok) {
    throw new Error(`模型请求失败 ${res.status}`);
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
        // 各家在流末尾发 usage chunk：DeepSeek 是独立 chunk，OpenAI 是 choices 为空的最后一块
        if (json?.usage && typeof json.usage === 'object' && Object.keys(json.usage).length > 0) {
          onUsage?.(json.usage as StreamUsage);
        }
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
  const body: Record<string, unknown> = {
    model: connection.model,
    prompt,
    n: opts.n ?? 1,
    size: opts.size || '1024x1024',
    response_format: opts.response_format || 'url',
  };
  const res = await safeFetch(endpoint(connection.base_url, '/images/generations'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(connection.extra_headers || {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`图片生成失败 ${res.status}`);
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
  const body: Record<string, unknown> = {
    model: connection.model,
    input: text,
    voice: opts.voice || 'alloy',
    speed: opts.speed ?? 1,
    response_format: opts.response_format || 'mp3',
  };
  const res = await safeFetch(endpoint(connection.base_url, '/audio/speech'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(connection.extra_headers || {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`语音生成失败 ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
