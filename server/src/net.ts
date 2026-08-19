import { lookup } from 'node:dns/promises';

/**
 * 可选的 SSRF 防护：当 ALLOW_PRIVATE_BASE_URLS=false 时，
 * 在发起模型请求前解析 host，拒绝私网/环回/链路本地地址。
 * 默认不启用，以兼容本地 Ollama / LM Studio / vLLM。
 */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 环回
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 链路本地
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0) return true; // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a >= 224) return true; // 224.0.0.0/4 组播与保留段
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // 环回
  if (lower === '::') return true; // 未指定地址
  if (lower.startsWith('::ffff:')) return isPrivateIPv4(lower.slice(7)); // IPv4 映射
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
  if (/^fe[89ab]/.test(lower)) return true; // 链路本地 fe80::/10
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

export async function assertPublicHost(host: string): Promise<void> {
  const { address } = await lookup(host, { verbatim: true });
  if (isPrivateAddress(address)) {
    throw new Error(`已禁止访问私网/环回地址（防 SSRF）：${host}`);
  }
}

/** 仅允许 http/https 或同源相对路径（如 /media/...）。 */
export function isSafeHttpUrl(url: string): boolean {
  if (url.startsWith('/')) return !url.startsWith('//');
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function assertSafeUrl(url: string): void {
  if (!isSafeHttpUrl(url)) throw new Error('仅支持 http/https 或相对路径 URL');
}
