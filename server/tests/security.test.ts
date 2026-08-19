import { describe, expect, it, vi } from 'vitest';
import { detectFileType } from '../src/routes/media.js';
import { isPrivateAddress, isSafeHttpUrl } from '../src/net.js';

// ---------- 文件类型嗅探（防任意文件上传 XSS） ----------
describe('detectFileType', () => {
  it('识别 PNG 魔数', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectFileType(buf)).toEqual({ kind: 'image', ext: 'png' });
  });

  it('识别 JPEG / GIF / WebP', () => {
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ kind: 'image', ext: 'jpg' });
    expect(detectFileType(Buffer.from('GIF89a....', 'ascii'))).toEqual({ kind: 'image', ext: 'gif' });
    const webp = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WEBP', 'ascii')]);
    expect(detectFileType(webp)).toEqual({ kind: 'image', ext: 'webp' });
  });

  it('识别音频容器（Ogg / FLAC / WAV / MP4 / MP3）', () => {
    expect(detectFileType(Buffer.from('OggS....', 'ascii'))).toEqual({ kind: 'audio', ext: 'ogg' });
    expect(detectFileType(Buffer.from('fLaC....', 'ascii'))).toEqual({ kind: 'audio', ext: 'flac' });
    const wav = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WAVE', 'ascii')]);
    expect(detectFileType(wav)).toEqual({ kind: 'audio', ext: 'wav' });
    const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A ', 'ascii')]);
    expect(detectFileType(mp4)).toEqual({ kind: 'audio', ext: 'm4a' });
    expect(detectFileType(Buffer.from('ID3\x04\x00\x00\x00', 'ascii'))).toEqual({ kind: 'audio', ext: 'mp3' });
    expect(detectFileType(Buffer.from([0xff, 0xfb, 0x90, 0x00]))).toEqual({ kind: 'audio', ext: 'mp3' });
  });

  it('拒绝 HTML / SVG / 未知内容（此前可上传 .html 造成存储型 XSS）', () => {
    expect(detectFileType(Buffer.from('<html><body><script>alert(1)</script></body></html>', 'utf8'))).toBeNull();
    expect(detectFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'utf8'))).toBeNull();
    expect(detectFileType(Buffer.from('random garbage bytes'))).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });
});

// ---------- 私网地址判断（可选 SSRF 防护） ----------
describe('isPrivateAddress', () => {
  it('判定私网/环回/链路本地为 true', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.1', '172.31.255.255', '169.254.1.1', '0.0.0.0', '100.64.0.1', '::1', 'fc00::1', 'fd12::1', 'fe80::1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('判定公网地址为 false', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '114.114.114.114', '2001:4860:4860::8888']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('处理 IPv4 映射地址', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });
});

// ---------- URL 协议白名单 ----------
describe('isSafeHttpUrl', () => {
  it('拒绝 javascript: 与 data: 协议', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,<script>1</script>')).toBe(false);
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
  });

  it('接受 http/https 与同源相对路径', () => {
    expect(isSafeHttpUrl('https://example.com/a.png')).toBe(true);
    expect(isSafeHttpUrl('http://127.0.0.1:8080/x')).toBe(true);
    expect(isSafeHttpUrl('/media/images/abc.png')).toBe(true);
    expect(isSafeHttpUrl('not a url')).toBe(false);
  });
});

// ---------- 登录限流（动态 import 以注入环境变量） ----------
describe('login rate limit', () => {
  it('超过窗口阈值后拒绝登录尝试', async () => {
    process.env.LOGIN_MAX_ATTEMPTS = '3';
    vi.resetModules(); // 重新求值 config（启动时读取 env）
    const auth = await import('../src/auth.js');
    auth.resetLoginLimiterForTest();

    const t0 = Date.now();
    expect(auth.isRateLimited('1.2.3.4', t0)).toBe(false);
    auth.recordFailure('1.2.3.4', t0);
    auth.recordFailure('1.2.3.4', t0);
    expect(auth.isRateLimited('1.2.3.4', t0)).toBe(false);
    auth.recordFailure('1.2.3.4', t0);
    expect(auth.isRateLimited('1.2.3.4', t0)).toBe(true);

    // 其他 IP 不受影响
    expect(auth.isRateLimited('5.6.7.8', t0)).toBe(false);

    // 窗口过期后重置
    expect(auth.isRateLimited('1.2.3.4', t0 + 16 * 60 * 1000)).toBe(false);
  });
});
