import { defineStore } from 'pinia';
import { api } from '@/api/client';

export const useAppStore = defineStore('app', {
  state: () => ({
    connections: [] as any[],
    characters: [] as any[],
    worldbooks: [] as any[],
    chats: [] as any[],
    groups: [] as any[],
    media: [] as any[],
    providers: [] as any[],
    loaded: false,
    loading: false,
  }),
  actions: {
    async loadAll(force = false) {
      if (this.loaded && !force) return;
      this.loading = true;
      try {
        const [conn, chars, wbs, chats, groups, media, providers] = await Promise.all([
          api.get('/api/connections'),
          api.get('/api/characters'),
          api.get('/api/worldbooks'),
          api.get('/api/chats'),
          api.get('/api/groups'),
          api.get('/api/media'),
          api.get('/api/providers/presets'),
        ]);
        this.connections = conn.connections;
        this.characters = chars.characters;
        this.worldbooks = wbs.worldbooks;
        this.chats = chats.chats;
        this.groups = groups.groups;
        this.media = media.media;
        this.providers = providers.presets;
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },
    async refreshConnections() {
      const res = await api.get('/api/connections');
      this.connections = res.connections;
    },
    async refreshCharacters() {
      const res = await api.get('/api/characters');
      this.characters = res.characters;
    },
    async refreshWorldbooks() {
      const res = await api.get('/api/worldbooks');
      this.worldbooks = res.worldbooks;
    },
    async refreshChats() {
      const res = await api.get('/api/chats');
      this.chats = res.chats;
    },
    async refreshGroups() {
      const res = await api.get('/api/groups');
      this.groups = res.groups;
    },
    async refreshMedia() {
      const res = await api.get('/api/media');
      this.media = res.media;
    },
  },
});
