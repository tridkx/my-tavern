import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { CORS_ORIGIN, IS_PROD, PUBLIC_DIR, UPLOAD_DIR } from './config.js';
import { isAuthenticated, isSecured, registerAuthRoutes } from './auth.js';
import { registerConnectionRoutes } from './routes/connections.js';
import { registerCharacterRoutes } from './routes/characters.js';
import { registerWorldbookRoutes } from './routes/worldbooks.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerGroupRoutes } from './routes/groups.js';
import { registerTtsRoutes } from './routes/tts.js';
import { registerImageRoutes } from './routes/images.js';
import { registerMediaRoutes } from './routes/media.js';
import { seedConnections } from './seed.js';

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 });

  // 生产/公网建议通过 CORS_ORIGIN 显式白名单；默认保持兼容（反射任意来源）
  await app.register(cors, {
    origin: CORS_ORIGIN.length > 0 ? CORS_ORIGIN : true,
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await app.register(fastifyStatic, {
    root: UPLOAD_DIR,
    prefix: '/media/',
    decorateReply: false,
    setHeaders(res) {
      // 上传内容一律不嗅探，且不允许被嵌入到第三方页面
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
    },
  });

  seedConnections();

  // 全局安全响应头：禁止嗅探与 iframe 嵌入
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    return payload;
  });

  app.addHook('preHandler', async (req, reply) => {
    const url = req.url.split('?')[0];
    const exempt = url === '/api/auth/login' || url === '/api/auth/status' || url === '/api/health';
    if (!exempt && (url.startsWith('/api') || url.startsWith('/media')) && isSecured() && !isAuthenticated(req)) {
      return reply.code(401).send({ error: '未认证' });
    }
  });

  app.get('/api/health', async (req) => ({ ok: true, secured: isSecured(), authenticated: isAuthenticated(req) }));

  registerAuthRoutes(app);
  registerConnectionRoutes(app);
  registerCharacterRoutes(app);
  registerWorldbookRoutes(app);
  registerChatRoutes(app);
  registerGroupRoutes(app);
  registerTtsRoutes(app);
  registerImageRoutes(app);
  registerMediaRoutes(app);

  if (IS_PROD && fs.existsSync(PUBLIC_DIR)) {
    await app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: '/' });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/media')) {
        return reply.code(404).send({ error: 'Not Found' });
      }
      return reply.sendFile('index.html');
    });
  }

  app.setErrorHandler((err: any, _req, reply) => {
    if (err && 'validation' in err) {
      return reply.code(400).send({ error: err.message });
    }
    app.log.error(err);
    // 不向客户端回显内部错误细节（SQL 语句、文件路径、堆栈等）
    return reply.code(500).send({ error: '服务器内部错误' });
  });

  return app;
}
