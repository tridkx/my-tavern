import { defineStore } from 'pinia';
import { api, streamPost } from '@/api/client';

export const useChatStore = defineStore('chat', {
  state: () => ({
    chatId: '' as string,
    mode: '' as string,
    messages: [] as any[],
    generating: false,
    streamingMessageId: '' as string,
    abortController: null as AbortController | null,
    /** 最近一次生成的 usage（含缓存命中统计），null 表示尚无数据 */
    lastUsage: null as any,
  }),
  actions: {
    async loadChat(chatId: string) {
      this.chatId = chatId;
      const res = await api.get(`/api/chats/${chatId}`);
      this.mode = res.chat?.mode || '';
      this.messages = res.messages || [];
    },
    async sendSingle(text: string) {
      if (!this.chatId || this.generating) return;
      this.generating = true;
      this.lastUsage = null;
      this.abortController = new AbortController();
      const userMsg = { id: `temp-${Date.now()}`, role: 'user', content: text, character_id: null, visible_to_player: 1, created_at: new Date().toISOString() };
      this.messages.push(userMsg);
      try {
        await streamPost(
          '/api/chat/generate',
          { chatId: this.chatId, userText: text },
          {
            onDelta: (delta, messageId) => {
              if (!this.streamingMessageId) {
                this.streamingMessageId = messageId;
                this.messages.push({ id: messageId, role: 'assistant', content: '', character_id: null, visible_to_player: 1, created_at: new Date().toISOString() });
              }
              const msg = this.messages.find((m) => m.id === messageId);
              if (msg) msg.content += delta;
            },
            onDone: (data) => {
              const idx = this.messages.findIndex((m) => m.id === data.messageId);
              if (idx >= 0) this.messages[idx] = data.message || this.messages[idx];
              this.streamingMessageId = '';
              this.lastUsage = data.usage || null;
            },
            onError: (err, data) => {
              this.messages = this.messages.filter((m) => m.id !== data.messageId);
              this.streamingMessageId = '';
              alert(err.message);
            },
          },
          this.abortController.signal,
        );
      } catch (e: any) {
        if (e?.name !== 'AbortError') alert(e.message || '请求失败');
      } finally {
        this.generating = false;
        this.streamingMessageId = '';
        this.abortController = null;
        // 用服务端真实消息替换本地临时 user 消息，保证后续编辑/删除/重试可用
        try {
          await this.loadChat(this.chatId);
        } catch {
          // 忽略刷新失败，至少保留本地视图
        }
      }
    },
    async sendGroup(speakerId: string, text?: string) {
      if (!this.chatId || this.generating) return;
      this.generating = true;
      this.lastUsage = null;
      this.abortController = new AbortController();
      if (text) {
        this.messages.push({ id: `temp-${Date.now()}`, role: 'user', content: text, character_id: null, visible_to_player: 1, created_at: new Date().toISOString() });
      }
      try {
        await streamPost(
          '/api/chat/generate-group',
          { chatId: this.chatId, speakerId, userText: text },
          {
            onDelta: (delta, messageId) => {
              if (!this.streamingMessageId) {
                this.streamingMessageId = messageId;
                this.messages.push({ id: messageId, role: 'assistant', content: '', character_id: speakerId, visible_to_player: 1, created_at: new Date().toISOString() });
              }
              const msg = this.messages.find((m) => m.id === messageId);
              if (msg) msg.content += delta;
            },
            onDone: (data) => {
              const idx = this.messages.findIndex((m) => m.id === data.messageId);
              if (idx >= 0) this.messages[idx] = data.message || this.messages[idx];
              this.streamingMessageId = '';
              this.lastUsage = data.usage || null;
            },
            onError: (err, data) => {
              this.messages = this.messages.filter((m) => m.id !== data.messageId);
              this.streamingMessageId = '';
              alert(err.message);
            },
          },
          this.abortController.signal,
        );
      } catch (e: any) {
        if (e?.name !== 'AbortError') alert(e.message || '请求失败');
      } finally {
        this.generating = false;
        this.streamingMessageId = '';
        this.abortController = null;
        // 用服务端真实消息替换本地临时 user 消息，保证后续编辑/删除/重试可用
        try {
          await this.loadChat(this.chatId);
        } catch {
          // 忽略刷新失败，至少保留本地视图
        }
      }
    },
    async stop() {
      if (this.streamingMessageId) {
        await api.post('/api/chat/stop', { messageId: this.streamingMessageId });
        this.abortController?.abort();
      }
    },
    async editMessage(messageId: string, content: string) {
      const res = await api.patch(`/api/messages/${messageId}`, { content });
      const idx = this.messages.findIndex((m) => m.id === messageId);
      if (idx >= 0) this.messages[idx] = res.message;
    },
    async deleteMessage(messageId: string) {
      await api.del(`/api/messages/${messageId}`);
      this.messages = this.messages.filter((m) => m.id !== messageId);
    },
    async regenerate(messageId: string) {
      const target = this.messages.find((m) => m.id === messageId);
      const res = await api.post(`/api/messages/${messageId}/regenerate`);
      this.messages = this.messages.filter((m) => m.id !== messageId);
      await this.loadChat(res.chatId);
      if (this.mode === 'group' && target?.character_id) {
        await this.sendGroup(target.character_id, '');
      } else {
        await this.sendSingle('');
      }
    },
  },
});
