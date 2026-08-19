import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ACCESS_TOKEN } from './config.js';

const COOKIE_NAME = 'my_tavern_token';

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
  return getToken(req) === ACCESS_TOKEN;
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/auth/status', async (req) => ({
    secured: isSecured(),
    authenticated: isAuthenticated(req),
  }));

  app.post('/api/auth/login', async (req, reply) => {
    const body = (req.body || {}) as { token?: string };
    if (!isSecured()) return { ok: true, authenticated: true };
    if (body.token !== ACCESS_TOKEN) {
      return reply.code(401).send({ error: '访问口令错误' });
    }
    reply.header(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(ACCESS_TOKEN)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
    );
    return { ok: true, authenticated: true };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.header('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
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
