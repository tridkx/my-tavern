import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createCharacter,
  deleteCharacter,
  getCharacter,
  listCharacters,
  updateCharacter,
} from '../repo.js';
import { fromTavernV2, toTavernV2 } from '../services/tavern.js';
import { generateCharacterDraft, polishCharacter } from '../services/aiTools.js';

const characterSchema = z.object({
  name: z.string().optional(),
  avatar_id: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  description: z.string().optional(),
  personality: z.string().optional(),
  scenario: z.string().optional(),
  first_mes: z.string().optional(),
  mes_example: z.string().optional(),
  system_prompt: z.string().optional(),
  post_history_instructions: z.string().optional(),
  creator: z.string().optional(),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  worldbook_id: z.string().nullable().optional(),
  connection_id: z.string().nullable().optional(),
  kind: z.enum(['general', 'special']).optional(),
  enabled: z.boolean().optional(),
});

export function registerCharacterRoutes(app: FastifyInstance) {
  app.get('/api/characters', async () => ({ characters: listCharacters() }));

  app.get('/api/characters/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const c = getCharacter(id);
    if (!c) return reply.code(404).send({ error: '角色不存在' });
    return { character: c };
  });

  app.post('/api/characters', async (req, reply) => {
    const body = characterSchema.parse(req.body || {});
    const data = { ...body, enabled: body.enabled === undefined ? undefined : body.enabled ? 1 : 0 };
    const c = createCharacter(data);
    return reply.code(201).send({ character: c });
  });

  app.put('/api/characters/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = characterSchema.parse(req.body || {});
    const data = { ...body, enabled: body.enabled === undefined ? undefined : body.enabled ? 1 : 0 };
    const c = updateCharacter(id, data);
    if (!c) return reply.code(404).send({ error: '角色不存在' });
    return { character: c };
  });

  app.delete('/api/characters/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = deleteCharacter(id);
    if (!ok) return reply.code(404).send({ error: '角色不存在' });
    return { ok: true };
  });

  app.get('/api/characters/:id/export', async (req, reply) => {
    const { id } = req.params as { id: string };
    const c = getCharacter(id);
    if (!c) return reply.code(404).send({ error: '角色不存在' });
    return reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(c.name)}.json"`).send(toTavernV2(c));
  });

  app.post('/api/characters/import', async (req, reply) => {
    const body = z.object({ json: z.unknown() }).parse(req.body || {});
    const data = fromTavernV2(body.json);
    const c = createCharacter(data);
    return reply.code(201).send({ character: c });
  });

  app.post('/api/characters/ai/generate', async (req, reply) => {
    const body = z
      .object({ prompt: z.string().min(1), connection_id: z.string().optional() })
      .parse(req.body || {});
    try {
      const draft = await generateCharacterDraft(body.prompt, body.connection_id);
      return { draft };
    } catch (err: any) {
      return reply.code(502).send({ error: err.message || 'AI 生成失败' });
    }
  });

  app.post('/api/characters/:id/ai/polish', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({ instruction: z.string().min(1), connection_id: z.string().optional() })
      .parse(req.body || {});
    const c = getCharacter(id);
    if (!c) return reply.code(404).send({ error: '角色不存在' });
    try {
      const draft = await polishCharacter(c, body.instruction, body.connection_id);
      return { draft };
    } catch (err: any) {
      return reply.code(502).send({ error: err.message || 'AI 润色失败' });
    }
  });
}
