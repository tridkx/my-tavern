import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getConnection, getDefaultConnection } from '../repo.js';
import { generateSpeech } from '../providers/openai.js';
import { mediaGenLimiter } from '../active.js';

export function registerTtsRoutes(app: FastifyInstance) {
  app.post('/api/tts', async (req, reply) => {
    const body = z
      .object({
        text: z.string().min(1),
        connectionId: z.string().optional(),
        voice: z.string().optional(),
        speed: z.number().min(0.25).max(4).optional(),
        response_format: z.enum(['mp3', 'opus', 'aac', 'flac', 'wav']).optional(),
      })
      .parse(req.body || {});

    const connection = body.connectionId ? getConnection(body.connectionId) : getDefaultConnection();
    if (!connection) return reply.code(400).send({ error: '没有可用的模型连接，请先在设置中添加连接' });

    if (!mediaGenLimiter.tryAcquire()) {
      return reply.code(429).send({ error: '生成任务过多，请稍后再试' });
    }
    try {
      const audio = await generateSpeech(connection, body.text, {
        voice: body.voice,
        speed: body.speed,
        response_format: body.response_format,
      });
      const format = body.response_format || 'mp3';
      return reply
        .header('Content-Type', `audio/${format}`)
        .header('Cache-Control', 'no-store')
        .send(audio);
    } catch (err: any) {
      return reply.code(502).send({ error: err.message || '语音生成失败' });
    } finally {
      mediaGenLimiter.release();
    }
  });
}
