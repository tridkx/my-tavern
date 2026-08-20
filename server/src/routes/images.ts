import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getConnection, getConnectionByType } from '../repo.js';
import { generateImage } from '../providers/openai.js';
import { mediaGenLimiter } from '../active.js';

export function registerImageRoutes(app: FastifyInstance) {
  app.post('/api/images/generate', async (req, reply) => {
    const body = z
      .object({
        prompt: z.string().min(1),
        connectionId: z.string().optional(),
        size: z.enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792']).optional(),
        n: z.number().int().min(1).max(4).optional(),
        response_format: z.enum(['url', 'b64_json']).optional(),
      })
      .parse(req.body || {});

    // 图片生成使用专门的 image 连接，与对话 LLM 分开配置
    const connection = body.connectionId ? getConnection(body.connectionId) : getConnectionByType('image');
    if (!connection) {
      return reply
        .code(400)
        .send({ error: '未配置图片生成连接，请先在 设置 → 模型连接 中新建一个用途为"图片生成"的连接' });
    }

    if (!mediaGenLimiter.tryAcquire()) {
      return reply.code(429).send({ error: '生成任务过多，请稍后再试' });
    }
    try {
      const data = await generateImage(connection, body.prompt, {
        size: body.size,
        n: body.n,
        response_format: body.response_format,
      });
      return { data };
    } catch (err: any) {
      return reply.code(502).send({ error: err.message || '图片生成失败' });
    } finally {
      mediaGenLimiter.release();
    }
  });
}
