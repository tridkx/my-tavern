import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  addGroupMember,
  createGroup,
  createMessage,
  deleteGroup,
  deleteMessage,
  getCharacter,
  getChat,
  getConnection,
  getDefaultConnection,
  getGroup,
  getMessage,
  listGroupMembers,
  listGroups,
  listMessages,
  removeGroupMember,
  updateGroup,
  updateGroupMember,
  updateMessage,
} from '../repo.js';
import { buildGroupTurnMessages } from '../services/context.js';
import { streamChat } from '../providers/openai.js';
import { activeGenerations } from '../active.js';
import type { Connection } from '../types.js';

const groupSchema = z.object({
  title: z.string().optional(),
  gm_character_id: z.string().nullable().optional(),
  settings: z
    .object({
      enemyActionVisible: z.boolean().optional(),
      autoMode: z.enum(['round-robin', 'manual', 'random']).optional(),
    })
    .optional(),
});

const memberSchema = z.object({
  character_id: z.string().optional(),
  kind: z.enum(['player', 'companion', 'gm', 'enemy']).optional(),
  enabled: z.boolean().optional(),
  connection_id: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
});

function resolveGroupConnection(groupId: string, characterId?: string, connectionId?: string): Connection | undefined {
  if (connectionId) {
    const c = getConnection(connectionId);
    if (c) return c;
  }
  if (characterId) {
    const c = getCharacter(characterId);
    if (c?.connection_id) {
      const conn = getConnection(c.connection_id);
      if (conn) return conn;
    }
  }
  const members = listGroupMembers(groupId);
  const member = members.find((m) => m.character_id === characterId);
  if (member?.connection_id) {
    const c = getConnection(member.connection_id);
    if (c) return c;
  }
  return getDefaultConnection();
}

function pickNextSpeaker(
  chatId: string,
  groupId: string,
  autoMode: 'round-robin' | 'manual' | 'random' = 'round-robin',
  gmCharacterId?: string | null,
): string {
  const members = listGroupMembers(groupId)
    .filter((m) => m.enabled && m.kind !== 'player')
    .sort((a, b) => a.sort_order - b.sort_order);
  if (!members.length) throw new Error('群聊中没有可发言的 AI 角色');

  const messages = listMessages(chatId);
  const last = [...messages].reverse().find((m) => m.character_id);

  // 隐藏的敌人行动之后优先让 GM 发言，避免非 GM 角色泄露隐藏信息
  if (gmCharacterId && last && !last.visible_to_player && members.some((m) => m.character_id === gmCharacterId)) {
    return gmCharacterId;
  }

  if (autoMode === 'random') {
    return members[Math.floor(Math.random() * members.length)].character_id;
  }
  if (!last?.character_id) return members[0].character_id;
  const idx = members.findIndex((m) => m.character_id === last.character_id);
  if (idx === -1) return members[0].character_id;
  return members[(idx + 1) % members.length].character_id;
}

export function registerGroupRoutes(app: FastifyInstance) {
  app.get('/api/groups', async () => ({ groups: listGroups() }));

  app.get('/api/groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const group = getGroup(id);
    if (!group) return reply.code(404).send({ error: '群聊不存在' });
    return { group, members: listGroupMembers(id) };
  });

  app.post('/api/groups', async (req, reply) => {
    const body = groupSchema.parse(req.body || {});
    const settings = body.settings
      ? { enemyActionVisible: body.settings.enemyActionVisible ?? true, autoMode: body.settings.autoMode ?? 'round-robin' }
      : undefined;
    const group = createGroup({ ...body, settings });
    return reply.code(201).send({ group });
  });

  app.patch('/api/groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = groupSchema.parse(req.body || {});
    const settings = body.settings
      ? { enemyActionVisible: body.settings.enemyActionVisible ?? true, autoMode: body.settings.autoMode ?? 'round-robin' }
      : undefined;
    const group = updateGroup(id, { ...body, settings });
    if (!group) return reply.code(404).send({ error: '群聊不存在' });
    return { group };
  });

  app.delete('/api/groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = deleteGroup(id);
    if (!ok) return reply.code(404).send({ error: '群聊不存在' });
    return { ok: true };
  });

  // members
  app.post('/api/groups/:id/members', async (req, reply) => {
    const { id } = req.params as { id: string };
    const group = getGroup(id);
    if (!group) return reply.code(404).send({ error: '群聊不存在' });
    const body = memberSchema.parse(req.body || {});
    const data = { ...body, enabled: body.enabled === undefined ? undefined : body.enabled ? 1 : 0 };
    const member = addGroupMember({ ...data, group_id: id });
    return reply.code(201).send({ member });
  });

  app.patch('/api/group-members/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = memberSchema.parse(req.body || {});
    const data = { ...body, enabled: body.enabled === undefined ? undefined : body.enabled ? 1 : 0 };
    const member = updateGroupMember(id, data);
    if (!member) return reply.code(404).send({ error: '成员不存在' });
    return { member };
  });

  app.delete('/api/group-members/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = removeGroupMember(id);
    if (!ok) return reply.code(404).send({ error: '成员不存在' });
    return { ok: true };
  });

  // group chat generation
  app.post('/api/chat/generate-group', async (req, reply) => {
    const body = z
      .object({
        chatId: z.string(),
        speakerId: z.string().optional(),
        userText: z.string().optional(),
        connectionId: z.string().optional(),
      })
      .parse(req.body || {});

    const chat = getChat(body.chatId);
    if (!chat?.group_id) return reply.code(404).send({ error: '群聊会话不存在' });
    const group = getGroup(chat.group_id);
    if (!group) return reply.code(404).send({ error: '群聊不存在' });

    const speakerId = body.speakerId || pickNextSpeaker(chat.id, group.id, group.settings.autoMode || 'round-robin', group.gm_character_id);
    if (group.settings.autoMode === 'manual' && !body.speakerId) {
      return reply.code(400).send({ error: '手动模式下请选择发言角色' });
    }
    const connection = resolveGroupConnection(group.id, speakerId, body.connectionId);
    if (!connection) return reply.code(400).send({ error: '没有可用的模型连接，请先在设置中添加连接' });

    if (body.userText) {
      createMessage({ chat_id: chat.id, role: 'user', content: body.userText });
    }

    const assistant = createMessage({
      chat_id: chat.id,
      role: 'assistant',
      character_id: speakerId,
      content: '',
      connection_id: connection.id,
    });

    const controller = new AbortController();
    activeGenerations.set(assistant.id, controller);

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (obj: unknown) => reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`);

    let content = '';
    try {
      const messages = buildGroupTurnMessages({
        chatId: chat.id,
        speakerId,
        connection,
        userText: body.userText,
      });
      for await (const delta of streamChat(connection, messages, {}, controller.signal)) {
        content += delta;
        send({ type: 'delta', messageId: assistant.id, delta });
      }
      const final = updateMessage(assistant.id, { content });
      send({ type: 'done', messageId: assistant.id, message: final });
    } catch (err: any) {
      if (content) {
        updateMessage(assistant.id, { content });
        send({ type: 'done', messageId: assistant.id, message: getMessage(assistant.id), aborted: true });
      } else {
        deleteMessage(assistant.id);
        send({ type: 'error', messageId: assistant.id, error: err?.message || '生成失败', aborted: controller.signal.aborted });
      }
    } finally {
      activeGenerations.delete(assistant.id);
      reply.raw.end();
    }
  });
}
