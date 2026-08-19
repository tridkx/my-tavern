import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createConnection, deleteConnection, getConnection, listConnections, updateConnection } from '../repo.js';
import { ALLOWED_API_KEY_ENVS, getProviderPreset, PROVIDER_PRESETS } from '../providers/presets.js';
import type { Connection } from '../types.js';

const connectionSchema = z.object({
  name: z.string().optional(),
  provider: z.string().optional(),
  base_url: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === '' || /^https?:\/\//i.test(v), { message: '仅支持 http/https 地址' }),
  api_key: z.string().optional(),
  api_key_env: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v == null || v === '' || ALLOWED_API_KEY_ENVS.has(v), { message: '不允许引用该环境变量' }),
  model: z.string().optional(),
  context_window: z.number().int().positive().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().positive().nullable().optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop_sequences: z.array(z.string()).optional(),
  extra_headers: z.record(z.string()).optional(),
  is_default: z.boolean().optional(),
});

function toPublic(conn: Connection) {
  const { api_key, ...rest } = conn;
  const envKeyAllowed = conn.api_key_env ? ALLOWED_API_KEY_ENVS.has(conn.api_key_env) : false;
  return {
    ...rest,
    api_key: '',
    has_api_key: Boolean(api_key || (envKeyAllowed && process.env[conn.api_key_env!])),
  };
}

export function registerConnectionRoutes(app: FastifyInstance) {
  app.get('/api/providers/presets', async () => {
    return { presets: PROVIDER_PRESETS };
  });

  app.get('/api/connections', async () => {
    return { connections: listConnections().map(toPublic) };
  });

  app.post('/api/connections', async (req, reply) => {
    const body = connectionSchema.parse(req.body || {});
    const preset = body.provider ? getProviderPreset(body.provider) : undefined;
    if (!body.base_url && preset) body.base_url = preset.baseUrl;
    if (!body.api_key_env && preset?.apiKeyEnv) body.api_key_env = preset.apiKeyEnv;
    const conn = createConnection(body as Partial<Connection>);
    return reply.code(201).send({ connection: toPublic(conn) });
  });

  app.put('/api/connections/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = connectionSchema.parse(req.body || {});
    const existing = getConnection(id);
    if (!existing) return reply.code(404).send({ error: '连接不存在' });
    // 前端不会回传 api_key，若未传则保留原 key
    if (body.api_key === undefined) body.api_key = existing.api_key;
    const conn = updateConnection(id, body as Partial<Connection>);
    return { connection: toPublic(conn!) };
  });

  app.delete('/api/connections/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = deleteConnection(id);
    if (!ok) return reply.code(404).send({ error: '连接不存在' });
    return { ok: true };
  });
}
