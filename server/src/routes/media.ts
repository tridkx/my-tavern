import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AUDIO_DIR, IMAGE_DIR, UPLOAD_DIR } from '../config.js';
import { createMedia, deleteMedia, getMedia, listMedia } from '../repo.js';

function dirForKind(kind: string): string {
  return kind === 'voice' ? AUDIO_DIR : IMAGE_DIR;
}

export function registerMediaRoutes(app: FastifyInstance) {
  app.get('/api/media', async (req) => {
    const query = req.query as { kind?: string };
    return { media: listMedia(query.kind) };
  });

  app.delete('/api/media/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const media = getMedia(id);
    if (!media) return reply.code(404).send({ error: '资源不存在' });
    if (media.file_path && media.source === 'upload') {
      try {
        fs.unlinkSync(media.file_path);
      } catch {
        // ignore
      }
    }
    deleteMedia(id);
    return { ok: true };
  });

  app.post('/api/media/from-url', async (req, reply) => {
    const body = z
      .object({ kind: z.enum(['background', 'avatar', 'image', 'voice']), name: z.string().optional(), url: z.string().url() })
      .parse(req.body || {});
    const media = createMedia({
      kind: body.kind,
      name: body.name || body.url.split('/').pop() || 'URL 资源',
      source: 'url',
      url: body.url,
    });
    return reply.code(201).send({ media });
  });

  app.post('/api/media/upload', async (req, reply) => {
    const parts = req.parts();
    let kind = 'image';
    let name = '';
    let buffer: Buffer | null = null;
    let filename = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        buffer = await part.toBuffer();
        filename = part.filename || `${randomUUID()}.bin`;
      } else if (part.type === 'field') {
        if (part.fieldname === 'kind') kind = String(part.value || 'image');
        if (part.fieldname === 'name') name = String(part.value || '');
      }
    }

    if (!buffer) return reply.code(400).send({ error: '没有收到文件' });
    const ext = path.extname(filename).toLowerCase();
    const savedName = `${randomUUID()}${ext || '.bin'}`;
    const dir = dirForKind(kind);
    const filePath = path.join(dir, savedName);
    fs.writeFileSync(filePath, buffer);
    const rel = path.relative(UPLOAD_DIR, filePath).split(path.sep).join('/');
    const media = createMedia({
      kind: kind as any,
      name: name || filename,
      file_path: filePath,
      source: 'upload',
      url: `/media/${rel}`,
    });
    return reply.code(201).send({ media });
  });
}
