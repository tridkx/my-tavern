import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createWorldbook,
  createWorldbookEntry,
  deleteWorldbook,
  deleteWorldbookEntry,
  getWorldbook,
  getWorldbookEntry,
  listWorldbookEntries,
  listWorldbooks,
  updateWorldbook,
  updateWorldbookEntry,
} from '../repo.js';
import { fromSillyTavernWorldInfo, toSillyTavernWorldInfo } from '../services/tavern.js';
import { generateWorldbookDraft } from '../services/aiTools.js';

const worldbookSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

const entrySchema = z.object({
  key: z.array(z.string()).optional(),
  content: z.string().optional(),
  enabled: z.boolean().optional(),
  constant: z.boolean().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  order_index: z.number().int().optional(),
  recursive: z.boolean().optional(),
  selective: z.boolean().optional(),
  position: z.enum(['before', 'after']).optional(),
  comment: z.string().optional(),
});

export function registerWorldbookRoutes(app: FastifyInstance) {
  app.get('/api/worldbooks', async () => ({ worldbooks: listWorldbooks() }));

  app.get('/api/worldbooks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wb = getWorldbook(id);
    if (!wb) return reply.code(404).send({ error: '世界书不存在' });
    return { worldbook: wb, entries: listWorldbookEntries(id) };
  });

  app.post('/api/worldbooks', async (req, reply) => {
    const body = worldbookSchema.parse(req.body || {});
    const wb = createWorldbook(body);
    return reply.code(201).send({ worldbook: wb });
  });

  app.put('/api/worldbooks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = worldbookSchema.parse(req.body || {});
    const wb = updateWorldbook(id, body);
    if (!wb) return reply.code(404).send({ error: '世界书不存在' });
    return { worldbook: wb };
  });

  app.delete('/api/worldbooks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = deleteWorldbook(id);
    if (!ok) return reply.code(404).send({ error: '世界书不存在' });
    return { ok: true };
  });

  // entries
  app.post('/api/worldbooks/:id/entries', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wb = getWorldbook(id);
    if (!wb) return reply.code(404).send({ error: '世界书不存在' });
    const body = entrySchema.parse(req.body || {});
    const data = {
      ...body,
      enabled: body.enabled === undefined ? undefined : body.enabled ? 1 : 0,
      constant: body.constant === undefined ? undefined : body.constant ? 1 : 0,
      recursive: body.recursive === undefined ? undefined : body.recursive ? 1 : 0,
      selective: body.selective === undefined ? undefined : body.selective ? 1 : 0,
    };
    const entry = createWorldbookEntry(id, data);
    return reply.code(201).send({ entry });
  });

  app.put('/api/worldbook-entries/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = entrySchema.parse(req.body || {});
    const data = {
      ...body,
      enabled: body.enabled === undefined ? undefined : body.enabled ? 1 : 0,
      constant: body.constant === undefined ? undefined : body.constant ? 1 : 0,
      recursive: body.recursive === undefined ? undefined : body.recursive ? 1 : 0,
      selective: body.selective === undefined ? undefined : body.selective ? 1 : 0,
    };
    const entry = updateWorldbookEntry(id, data);
    if (!entry) return reply.code(404).send({ error: '条目不存在' });
    return { entry };
  });

  app.delete('/api/worldbook-entries/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = deleteWorldbookEntry(id);
    if (!ok) return reply.code(404).send({ error: '条目不存在' });
    return { ok: true };
  });

  // import/export
  app.get('/api/worldbooks/:id/export', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wb = getWorldbook(id);
    if (!wb) return reply.code(404).send({ error: '世界书不存在' });
    const entries = listWorldbookEntries(id);
    return reply
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(wb.name)}.json"`)
      .send({ name: wb.name, description: wb.description, entries: toSillyTavernWorldInfo(entries) });
  });

  app.post('/api/worldbooks/import', async (req, reply) => {
    const body = z.object({ name: z.string().optional(), json: z.unknown() }).parse(req.body || {});
    const parsed = fromSillyTavernWorldInfo(body.json);
    const wb = createWorldbook({ name: body.name || (body.json as any)?.name || '导入的世界书' });
    for (const e of parsed) createWorldbookEntry(wb.id, e);
    return reply.code(201).send({ worldbook: wb, entries: listWorldbookEntries(wb.id) });
  });

  // AI 生成
  app.post('/api/worldbooks/ai/generate', async (req, reply) => {
    const body = z
      .object({ prompt: z.string().min(1), connection_id: z.string().optional() })
      .parse(req.body || {});
    try {
      const draft = await generateWorldbookDraft(body.prompt, body.connection_id);
      return { draft };
    } catch (err: any) {
      return reply.code(502).send({ error: err.message || 'AI 生成失败' });
    }
  });
}
