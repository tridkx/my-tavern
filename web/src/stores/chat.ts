import { defineStore } from 'pinia';
import { api, streamPost } from '@/api/client';

export const useChatStore = defineStore('chat', {
  state: () => ({
    chatId: '' as string,
    messages: [] as any[],
    generating: false,
    streamingMessageId: '' as string,
    abortController: null as AbortController | null,
  }),
  actions: {
    async loadChat(chatId: string) {
      this.chatId = chatId;
      const res = await api.get(`/api/chats/${chatId}`);
      this.messages = res.messages || [];
    },
    async sendSingle(text: string) {
      if (!this.chatId || this.generating) return;
      this.generating = true;
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
            },
            onError: (err, data) => {
              this.messages = this.messages.filter((m) => m.id !== data.messageId);
              this.streamingMessageId = '';
              alert(err.message);
            },
          },
          this.abortController.signal,
        );
      } finally {
        this.generating = false;
        this.abortController = null;
      }
    },
    async sendGroup(speakerId: string, text?: string) {
      if (!this.chatId || this.generating) return;
      this.generating = true;
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
            },
            onError: (err, data) => {
              this.messages = this.messages.filter((m) => m.id !== data.messageId);
              this.streamingMessageId = '';
              alert(err.message);
            },
          },
          this.abortController.signal,
        );
      } finally {
        this.generating = false;
        this.abortController = null;
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
      const res = await api.post(`/api/messages/${messageId}/regenerate`);
      this.messages = this.messages.filter((m) => m.id !== messageId);
      await this.loadChat(res.chatId);
      await this.sendSingle('');
    },
  },
});
