import type { Connection } from '../types.js';
import { resolveApiKey } from './presets.js';
import { assertBaseUrlAllowed, safeFetch } from './openai.js';

/**
 * 阿里云百炼（DashScope）原生语音合成。
 *
 * 百炼没有 OpenAI 兼容的 /audio/speech，TTS 走 DashScope 原生 HTTP 接口：
 *   POST {base}/api/v1/services/audio/tts/SpeechSynthesizer
 * 非流式响应为 JSON，音频文件在 output.audio.url（有效期 24 小时）。
 *
 * 连接要求：
 * - base_url: https://dashscope.aliyuncs.com（无版本后缀，内部拼接 /api/v1/...）
 * - model: qwen-audio-3.0-tts-flash / qwen-audio-3.0-tts-plus / cosyvoice-v3-flash 等
 */

/** 百炼系统音色（Qwen-Audio-TTS / CosyVoice 音色列表中的示例音色）。 */
const DEFAULT_VOICE = 'longanhuan_v3.6';

export async function generateDashScopeSpeech(
  connection: Connection,
  text: string,
  opts: { voice?: string; speed?: number; format?: string } = {},
): Promise<Buffer> {
  const apiKey = resolveApiKey(connection);
  if (!apiKey) throw new Error('未配置 API Key（DASHSCOPE_API_KEY）');

  const base = (connection.base_url || '').replace(/\/+$/, '');
  if (!base) throw new Error('未配置 API 地址 base_url');
  const url = `${base}/api/v1/services/audio/tts/SpeechSynthesizer`;

  // 前端默认音色 alloy 是 OpenAI 风格，对百炼无效，替换为百炼默认音色
  const voice = opts.voice && opts.voice !== 'alloy' ? opts.voice : DEFAULT_VOICE;

  // 百炼 rate（语速）取值范围 0.5 ~ 2.0
  const rate = opts.speed ? Math.min(2, Math.max(0.5, opts.speed)) : undefined;

  const body: Record<string, unknown> = {
    model: connection.model,
    input: {
      text,
      voice,
      format: opts.format || 'mp3',
      sample_rate: 24000,
      ...(rate !== undefined ? { rate } : {}),
    },
  };

  const res = await safeFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`语音生成失败 ${res.status}${errText ? `：${errText.slice(0, 200)}` : ''}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('语音生成失败：响应不是有效 JSON');
  }
  const audioUrl: string | undefined = data?.output?.audio?.url;
  if (!audioUrl) {
    const errMsg = data?.message || data?.code || '';
    throw new Error(`语音生成失败：未返回音频地址${errMsg ? `（${errMsg}）` : ''}`);
  }

  // 下载音频文件（URL 来自百炼响应，仍走同一套 SSRF 校验）
  await assertBaseUrlAllowed(audioUrl);
  const audioRes = await safeFetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(`音频下载失败 ${audioRes.status}`);
  }
  return Buffer.from(await audioRes.arrayBuffer());
}
