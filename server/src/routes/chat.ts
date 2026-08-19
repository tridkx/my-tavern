import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createChat,
  createMessage,
  deleteChat,
  deleteMessage,
  deleteMessagesAfter,
  deleteMessagesAfterExclusive,
  getChat,
  getCharacter,
  getConnection,
  getDefaultConnection,
  getGroup,
  getMessage,
  listChats,
  listGroupMembers,
  listMessages,
  updateChat,
  updateMessage,
} from '../repo.js';
import { buildSingleTurnMessages, buildGroupTurnMessages, estimateTokens } from '../services/context.js';
import { streamChat } from '../providers/openai.js';
import { activeGenerations, abortGeneration } from '../active.js';
import type { Connection } from '../types.js';

const chatSchema = z.object({
  title: z.string().optional(),
  mode: z.enum(['single', 'group']).optional(),
  character_id: z.string().nullable().optional(),
  group_id: z.string().nullable().optional(),
  background_id: z.string().nullable().optional(),
});

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'narrator', 'gm', 'companion', 'enemy']).optional(),
  character_id: z.string().nullable().optional(),
  content: z.string().optional(),
  visible_to_player: z.boolean().optional(),
  connection_id: z.string().nullable().optional(),
});

function resolveConnection(chatId: string, connectionId?: string): Connection | undefined {
  if (connectionId) {
    const c = getConnection(connectionId);
    if (c) return c;
  }
  const chat = getChat(chatId);
  if (chat?.character_id) {
    const character = getCharacter(chat.character_id);
    if (character?.connection_id) {
      const c = getConnection(character.connection_id);
      if (c) return c;
    }
  }
  return getDefaultConnection();
}

export function registerChatRoutes(app: FastifyInstance) {
  // ---------- chats ----------
  app.get('/api/chats', async () => ({ chats: listChats() }));

  app.post('/api/chats', async (req, reply) => {
    const body = chatSchema.parse(req.body || {});
    const chat = createChat(body);
    return reply.code(201).send({ chat });
  });

  app.get('/api/chats/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const chat = getChat(id);
    if (!chat) return reply.code(404).send({ error: '会话不存在' });
    return { chat, messages: listMessages(id) };
  });

  app.patch('/api/chats/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = chatSchema.parse(req.body || {});
    const chat = updateChat(id, body);
    if (!chat) return reply.code(404).send({ error: '会话不存在' });
    return { chat };
  });

  app.delete('/api/chats/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = deleteChat(id);
    if (!ok) return reply.code(404).send({ error: '会话不存在' });
    return { ok: true };
  });

  // ---------- messages ----------
  app.get('/api/chats/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    const chat = getChat(id);
    if (!chat) return reply.code(404).send({ error: '会话不存在' });
    return { messages: listMessages(id) };
  });

  app.post('/api/chats/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    const chat = getChat(id);
    if (!chat) return reply.code(404).send({ error: '会话不存在' });
    const body = messageSchema.parse(req.body || {});
    const data = { ...body, visible_to_player: body.visible_to_player === undefined ? undefined : body.visible_to_player ? 1 : 0 };
    const msg = createMessage({ ...data, chat_id: id, content: body.content || '' });
    return reply.code(201).send({ message: msg });
  });

  app.patch('/api/messages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = messageSchema.parse(req.body || {});
    const data = { ...body, visible_to_player: body.visible_to_player === undefined ? undefined : body.visible_to_player ? 1 : 0 };
    const msg = updateMessage(id, data);
    if (!msg) return reply.code(404).send({ error: '消息不存在' });
    return { message: msg };
  });

  app.delete('/api/messages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = deleteMessage(id);
    if (!ok) return reply.code(404).send({ error: '消息不存在' });
    return { ok: true };
  });

  app.post('/api/messages/:id/regenerate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const msg = getMessage(id);
    if (!msg) return reply.code(404).send({ error: '消息不存在' });
    deleteMessagesAfter(msg.chat_id, id);
    // 删除自身，然后走一次普通生成流程（不附加用户文本）
    const chat = getChat(msg.chat_id);
    if (!chat) return reply.code(404).send({ error: '会话不存在' });
    const content = msg.content;
    deleteMessage(id);
    return { chatId: chat.id, regenerateContent: content };
  });

  app.post('/api/messages/:id/delete-after', async (req, reply) => {
    const { id } = req.params as { id: string };
    const msg = getMessage(id);
    if (!msg) return reply.code(404).send({ error: '消息不存在' });
    deleteMessagesAfterExclusive(msg.chat_id, id);
    return { ok: true };
  });

  app.post('/api/chats/:id/fork', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ fromMessageId: z.string(), title: z.string().optional() }).parse(req.body || {});
    const chat = getChat(id);
    if (!chat) return reply.code(404).send({ error: '会话不存在' });
    const from = getMessage(body.fromMessageId);
    if (!from || from.chat_id !== id) return reply.code(400).send({ error: '消息不存在于该会话' });

    const newChat = createChat({
      title: body.title || (chat.title ? `${chat.title} (分支)` : '分支会话'),
      mode: chat.mode,
      character_id: chat.character_id,
      group_id: chat.group_id,
      background_id: chat.background_id,
    });

    for (const m of listMessages(id)) {
      createMessage({
        chat_id: newChat.id,
        role: m.role,
        character_id: m.character_id,
        content: m.content,
        visible_to_player: m.visible_to_player,
        connection_id: m.connection_id,
      });
      if (m.id === body.fromMessageId) break;
    }
    return reply.code(201).send({ chat: newChat, messages: listMessages(newChat.id) });
  });

  // ---------- context preview ----------
  app.post('/api/chats/:id/context-preview', async (req, reply) => {
    const { id } = req.params as { id: string };
    const chat = getChat(id);
    if (!chat) return reply.code(404).send({ error: '会话不存在' });
    const body = z
      .object({
        userText: z.string().optional(),
        connectionId: z.string().optional(),
        speakerId: z.string().optional(),
      })
      .parse(req.body || {});

    const connection = resolveConnection(id, body.connectionId);
    if (!connection) return reply.code(400).send({ error: '没有可用的模型连接，请先在设置中添加连接' });

    let messages;
    if (chat.mode === 'group') {
      const speakerId = body.speakerId || listGroupMembers(chat.group_id || '').find((m) => m.kind !== 'player')?.character_id;
      if (!speakerId) return reply.code(400).send({ error: '群聊中没有可发言的 AI 角色' });
      messages = buildGroupTurnMessages({ chatId: id, speakerId, connection, userText: body.userText });
    } else {
      messages = buildSingleTurnMessages({ chatId: id, userText: body.userText, connection });
    }
    const totalTokens = estimateTokens(JSON.stringify(messages));
    const maxTokens = connection.context_window || 8192;
    return { messages, totalTokens, maxTokens, usagePercent: Math.min(100, Math.round((totalTokens / maxTokens) * 100)) };
  });

  // ---------- streaming generation ----------
  app.post('/api/chat/generate', async (req, reply) => {
    const body = z
      .object({
        chatId: z.string(),
        userText: z.string().optional(),
        connectionId: z.string().optional(),
        extraSystem: z.string().optional(),
      })
      .parse(req.body || {});

    const chat = getChat(body.chatId);
    if (!chat) return reply.code(404).send({ error: '会话不存在' });

    const connection = resolveConnection(body.chatId, body.connectionId);
    if (!connection) return reply.code(400).send({ error: '没有可用的模型连接，请先在设置中添加连接' });

    if (body.userText) {
      createMessage({ chat_id: body.chatId, role: 'user', content: body.userText });
    }

    const assistant = createMessage({
      chat_id: body.chatId,
      role: chat.mode === 'group' ? 'assistant' : 'assistant',
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

    const send = (obj: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    let content = '';
    try {
      const messages = buildSingleTurnMessages({
        chatId: body.chatId,
        userText: body.userText,
        connection,
        extraSystem: body.extraSystem,
      });
      for await (const delta of streamChat(connection, messages, {}, controller.signal)) {
        content += delta;
        send({ type: 'delta', messageId: assistant.id, delta });
      }
      const final = updateMessage(assistant.id, { content });
      send({ type: 'done', messageId: assistant.id, message: final });
    } catch (err: any) {
      const aborted = controller.signal.aborted;
      if (content) {
        updateMessage(assistant.id, { content });
        send({ type: 'done', messageId: assistant.id, message: getMessage(assistant.id), aborted: true });
      } else {
        deleteMessage(assistant.id);
        send({ type: 'error', messageId: assistant.id, error: err?.message || '生成失败', aborted });
      }
    } finally {
      activeGenerations.delete(assistant.id);
      reply.raw.end();
    }
  });

  app.post('/api/chat/stop', async (req, reply) => {
    const body = z.object({ messageId: z.string() }).parse(req.body || {});
    const ok = abortGeneration(body.messageId);
    return { ok };
  });
}
