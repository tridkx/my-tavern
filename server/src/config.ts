import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(serverRoot, '..');

export const DATA_DIR = process.env.MY_TAVERN_DATA
  ? path.resolve(process.env.MY_TAVERN_DATA)
  : path.join(projectRoot, 'data');

export const DB_PATH = path.join(DATA_DIR, 'my-tavern.db');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const AUDIO_DIR = path.join(UPLOAD_DIR, 'audio');
export const IMAGE_DIR = path.join(UPLOAD_DIR, 'images');

export const PORT = Number(process.env.PORT || 3000);
export const HOST = process.env.HOST || '0.0.0.0';
/** 部署在可信反向代理后时设为 1/true，使 req.ip 使用 X-Forwarded-For 等代理头。 */
export const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
export const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
export const PUBLIC_DIR = path.join(serverRoot, '..', 'web', 'dist');
export const IS_PROD = process.env.NODE_ENV === 'production';

/** 逗号分隔的允许跨域来源；留空表示关闭跨域（同源部署默认行为，前端不受影响）。生产建议显式设置。 */
export const CORS_ORIGIN = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** 设为 1 时给登录 Cookie 加 Secure 标志并启用 __Host- 前缀（需在 HTTPS 下使用）。 */
export const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';

/** 登录限流：窗口内允许的最大失败次数（0 表示关闭限流）。 */
export const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 10);
export const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);

/** 出站模型请求超时（毫秒），防止 provider 挂死拖住连接。 */
export const OUTBOUND_TIMEOUT_MS = Number(process.env.OUTBOUND_TIMEOUT_MS || 120_000);

/** 并发生成的上限，超出返回 429。 */
export const MAX_CONCURRENT_GENERATIONS = Number(process.env.MAX_CONCURRENT_GENERATIONS || 8);

/** TTS / 图片生成的并发上限（防止认证后并发烧 API 额度），超出返回 429。 */
export const MAX_CONCURRENT_MEDIA_GENERATIONS = Number(process.env.MAX_CONCURRENT_MEDIA_GENERATIONS || 4);

/** 上传并发上限（每个上传会整文件读入内存，限制并发避免内存被耗尽），超出返回 429。 */
export const MAX_CONCURRENT_UPLOADS = Number(process.env.MAX_CONCURRENT_UPLOADS || 4);

/**
 * 设为 'false' 时拒绝把模型请求发往私网/环回/链路本地地址（防 SSRF）。
 * 默认允许，以兼容本地 Ollama / LM Studio / vLLM。
 */
export const ALLOW_PRIVATE_BASE_URLS = process.env.ALLOW_PRIVATE_BASE_URLS !== 'false';

export function ensureDataDirs() {
  for (const dir of [DATA_DIR, UPLOAD_DIR, AUDIO_DIR, IMAGE_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
