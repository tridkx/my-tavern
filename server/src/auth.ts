import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ACCESS_TOKEN, COOKIE_SECURE, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } from './config.js';

// __Host- 前缀要求 Secure + Path=/ + 无 Domain，仅在全 HTTPS 部署时启用
const COOKIE_NAME = COOKIE_SECURE ? '__Host-my_tavern_token' : 'my_tavern_token';

function cookieOptions(extra?: string): string {
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax', ...(COOKIE_SECURE ? ['Secure'] : [])];
  if (extra) parts.push(extra);
  return parts.join('; ');
}

/** 恒定时间比较，避免通过响应时间差逐位猜解口令。 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ---------- 登录失败限流（内存滑动窗口：按 IP + 全局兜底） ----------
interface Bucket {
  count: number;
  windowStart: number;
}
const loginFailures = new Map<string, Bucket>();
let globalFailures: Bucket = { count: 0, windowStart: Date.now() };

function pruneBuckets(now: number) {
  for (const [k, b] of loginFailures) {
    if (now - b.windowStart > LOGIN_WINDOW_MS) loginFailures.delete(k);
  }
  if (now - globalFailures.windowStart > LOGIN_WINDOW_MS) {
    globalFailures = { count: 0, windowStart: now };
  }
}

function isRateLimited(ip: string, now = Date.now()): boolean {
  if (LOGIN_MAX_ATTEMPTS <= 0) return false;
  pruneBuckets(now);
  const b = loginFailures.get(ip);
  if (b && now - b.windowStart <= LOGIN_WINDOW_MS && b.count >= LOGIN_MAX_ATTEMPTS) return true;
  // 全局兜底：即使按 IP 被代理隐藏（共享代理 IP），整体失败速率仍受限
  if (globalFailures.count >= LOGIN_MAX_ATTEMPTS * 5) return true;
  return false;
}

function recordFailure(ip: string, now = Date.now()) {
  pruneBuckets(now);
  const b = loginFailures.get(ip);
  if (!b || now - b.windowStart > LOGIN_WINDOW_MS) {
    loginFailures.set(ip, { count: 1, windowStart: now });
  } else {
    b.count += 1;
  }
  if (now - globalFailures.windowStart > LOGIN_WINDOW_MS) {
    globalFailures = { count: 1, windowStart: now };
  } else {
    globalFailures.count += 1;
  }
}

export function resetLoginLimiterForTest() {
  loginFailures.clear();
  globalFailures = { count: 0, windowStart: Date.now() };
}

// 导出仅供单元测试使用
export { isRateLimited, recordFailure };

function getToken(req: FastifyRequest): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookie = req.headers.cookie || '';
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE_NAME) return v.join('=').trim();
  }
  return '';
}

export function isSecured(): boolean {
  return Boolean(ACCESS_TOKEN);
}

export function isAuthenticated(req: FastifyRequest): boolean {
  if (!isSecured()) return true;
  const token = getToken(req);
  if (!token) return false;
  return safeEqual(token, ACCESS_TOKEN);
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/auth/status', async (req) => ({
    secured: isSecured(),
    authenticated: isAuthenticated(req),
  }));

  app.post('/api/auth/login', async (req, reply) => {
    const body = (req.body || {}) as { token?: string };
    if (!isSecured()) return { ok: true, authenticated: true };

    const ip = req.ip || '';
    if (isRateLimited(ip)) {
      return reply.code(429).send({ error: '尝试过于频繁，请稍后再试' });
    }
    if (typeof body.token !== 'string' || !safeEqual(body.token, ACCESS_TOKEN)) {
      recordFailure(ip);
      return reply.code(401).send({ error: '访问口令错误' });
    }
    reply.header('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(ACCESS_TOKEN)}; ${cookieOptions('Max-Age=31536000')}`);
    return { ok: true, authenticated: true };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.header('Set-Cookie', `${COOKIE_NAME}=; ${cookieOptions('Max-Age=0')}`);
    return { ok: true };
  });
}

export function authGuard(req: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (isSecured() && !isAuthenticated(req)) {
    reply.code(401).send({ error: '未认证' });
    return;
  }
  done();
}
