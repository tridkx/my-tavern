<template>
  <div class="page chat-page" :style="backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' } : {}">
    <div class="row chat-header">
      <select v-model="selectedChatId" style="flex: 1" @change="switchChat">
        <option value="">选择会话…</option>
        <option v-for="ch in app.chats" :key="ch.id" :value="ch.id">{{ ch.title || '未命名会话' }}</option>
      </select>
      <button @click="toggleContext">上下文</button>
      <button @click="showNew = !showNew">新建</button>
    </div>

    <div v-if="showContext && contextPreview" class="card context-panel">
      <div class="row">
        <strong>上下文预览</strong>
        <span class="spacer" />
        <button @click="showContext = false">关闭</button>
      </div>
      <div class="muted">
        估算 {{ contextPreview.totalTokens }} / {{ contextPreview.maxTokens }} tokens（{{ contextPreview.usagePercent }}%）
      </div>
      <pre>{{ JSON.stringify(contextPreview.messages, null, 2) }}</pre>
    </div>

    <div v-if="currentChat" class="row" style="margin-bottom: 6px">
      <select v-model="selectedBackground" style="flex: 1" @change="setBackground">
        <option value="">无背景图</option>
        <option v-for="b in backgrounds" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
    </div>

    <div v-if="showNew" class="card" style="margin: 10px 0">
      <h3>新建会话</h3>
      <label>模式</label>
      <select v-model="newMode">
        <option value="single">单人</option>
        <option value="group">群聊</option>
      </select>
      <template v-if="newMode === 'single'">
        <label>角色</label>
        <select v-model="newCharacterId">
          <option v-for="c in app.characters" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <label>会话标题</label>
        <input v-model="newTitle" placeholder="可选" />
      </template>
      <template v-else>
        <label>群聊</label>
        <select v-model="newGroupId">
          <option v-for="g in app.groups" :key="g.id" :value="g.id">{{ g.title }}</option>
        </select>
        <button @click="createGroupPanel = !createGroupPanel">新建群聊</button>
        <div v-if="createGroupPanel">
          <label>群聊名称</label>
          <input v-model="groupTitle" />
          <button class="primary" @click="createGroup">创建群聊</button>
        </div>
        <label>会话标题</label>
        <input v-model="newTitle" placeholder="可选" />
      </template>
      <div class="row" style="margin-top: 10px">
        <button class="primary" @click="createChat">创建</button>
        <button @click="showNew = false">取消</button>
      </div>
    </div>

    <div v-if="currentChat?.mode === 'group'" class="card group-panel">
      <div class="row">
        <strong>群聊设置</strong>
        <span class="spacer" />
        <label style="display: flex; align-items: center; gap: 6px">
          <input type="checkbox" :checked="group?.settings?.enemyActionVisible !== false" @change="toggleEnemyVisible" /> 敌人行动对玩家可见
        </label>
      </div>
      <div class="row" style="margin-top: 8px">
        <label style="display: flex; align-items: center; gap: 6px">模式
          <select v-model="autoMode" @change="setAutoMode" style="width: auto">
            <option value="round-robin">轮询</option>
            <option value="random">随机</option>
            <option value="manual">手动</option>
          </select>
        </label>
        <span class="spacer" />
      </div>
      <div class="row" style="margin-top: 8px">
        <select v-model="manualSpeaker" style="flex: 1">
          <option value="">{{ autoMode === 'manual' ? '请选择发言人' : '自动选择发言人' }}</option>
          <option v-for="m in groupMembers" :key="m.id" :value="m.character_id">{{ memberName(m.character_id) }} ({{ memberKind(m.kind) }})</option>
        </select>
        <button class="primary" :disabled="chat.generating" @click="sendGroupNow">{{ chat.generating ? '生成中…' : '生成回复' }}</button>
      </div>
      <details>
        <summary>管理成员</summary>
        <div class="member-row" v-for="m in groupMembers" :key="m.id">
          <span>{{ memberName(m.character_id) }}</span>
          <select :value="m.kind" @change="updateMemberKind(m, ($event.target as HTMLSelectElement).value)">
            <option value="player">玩家</option>
            <option value="companion">AI同伴</option>
            <option value="gm">GM</option>
            <option value="enemy">AI敌人</option>
          </select>
          <button @click="removeMember(m.id)">移除</button>
        </div>
        <div class="row" style="margin-top: 8px">
          <select v-model="addCharId" style="flex: 1">
            <option v-for="c in app.characters" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <select v-model="addCharKind" style="flex: 1">
            <option value="companion">AI同伴</option>
            <option value="gm">GM</option>
            <option value="enemy">AI敌人</option>
            <option value="player">玩家</option>
          </select>
          <button @click="addMember">添加</button>
        </div>
      </details>
    </div>

    <div v-if="currentChat" class="chat-messages">
      <div
        v-for="m in chat.messages"
        :key="m.id"
        class="message"
        :class="{ user: m.role === 'user', 'hidden-action': !m.visible_to_player }"
      >
        <div class="avatar">
          <img v-if="characterAvatar(m.character_id)" :src="characterAvatar(m.character_id)" />
          <span v-else>{{ displayName(m).slice(0, 1) }}</span>
        </div>
        <div style="flex: 1; min-width: 0">
          <div class="meta">
            <strong>{{ displayName(m) }}</strong>
            <span v-if="!m.visible_to_player" class="hidden-tag">隐藏行动</span>
            <span v-if="m.id === chat.streamingMessageId" class="typing-dot">●</span>
          </div>
          <div class="bubble" :class="{ editing: editId === m.id }">
            <textarea
              v-if="editId === m.id"
              v-model="editContent"
              rows="4"
              style="margin-bottom: 6px"
            ></textarea>
            <template v-else>{{ m.content }}</template>
            <div v-if="editId === m.id" class="row" style="margin-top: 4px">
              <button @click="saveEdit(m.id)">保存</button>
              <button @click="editId = ''">取消</button>
            </div>
          </div>
          <div class="row msg-actions">
            <button class="sm" v-if="!editId || editId !== m.id" @click="startEdit(m)">编辑</button>
            <button class="sm" @click="toggleHidden(m)">{{ m.visible_to_player ? '隐藏' : '显示' }}</button>
            <button class="sm" @click="forkMessage(m)">分支</button>
            <button class="sm" @click="deleteAfter(m)">删除之后</button>
            <button class="sm" @click="chat.regenerate(m.id)">重试</button>
            <button class="sm danger" @click="chat.deleteMessage(m.id)">删除</button>
          </div>
        </div>
      </div>
      <p v-if="!chat.messages.length" class="empty">
        <span class="empty-icon">🍻</span>
        还没有消息，倒满第一杯开始聊吧
      </p>
    </div>

    <div v-if="currentChat" class="composer">
      <div v-if="cacheStats" class="cache-stats" title="模型返回的 usage 统计（各家字段名不同，能解析到才显示）">
        本次生成：{{ cacheStats.hit }} 命中 / {{ cacheStats.miss }} 未命中 tokens · 缓存命中率 {{ cacheStats.rate }}%
      </div>
      <textarea
        v-model="inputText"
        rows="2"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        @keydown="onKeydown"
      ></textarea>
      <button v-if="chat.generating" class="danger" @click="chat.stop()">停止</button>
      <button v-else class="primary" @click="sendNow" :disabled="!inputText.trim() && !currentChat.group_id">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useChatStore } from '@/stores/chat';
import { api } from '@/api/client';

const app = useAppStore();
const chat = useChatStore();
const route = useRoute();
const router = useRouter();

const selectedChatId = ref('');
const currentChat = computed(() => app.chats.find((c) => c.id === selectedChatId.value));
const showNew = ref(false);
const newMode = ref('single');
const newCharacterId = ref('');
const newGroupId = ref('');
const newTitle = ref('');
const groupTitle = ref('');
const createGroupPanel = ref(false);
const inputText = ref('');
const editId = ref('');
const editContent = ref('');
const manualSpeaker = ref('');
const groupMembers = ref<any[]>([]);
const addCharId = ref('');
const addCharKind = ref('companion');
const group = ref<any>(null);
const selectedBackground = ref('');
const autoMode = ref('round-robin');
const showContext = ref(false);
const contextPreview = ref<any>(null);

const backgrounds = computed(() => app.media.filter((m) => m.kind === 'background'));
const backgroundUrl = computed(() => {
  const b = backgrounds.value.find((x) => x.id === selectedBackground.value);
  return b?.url || '';
});

/** 归一化各家 usage 字段，计算缓存命中率；无法解析时返回 null 不显示。 */
const cacheStats = computed(() => {
  const u = chat.lastUsage as any;
  if (!u) return null;
  const hit =
    u.prompt_cache_hit_tokens ?? u.cached_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0;
  const miss =
    u.prompt_cache_miss_tokens ?? (typeof u.prompt_tokens === 'number' ? Math.max(0, u.prompt_tokens - hit) : 0);
  const total = hit + miss;
  if (!total) return null;
  return { hit, miss, rate: Math.round((hit / total) * 100) };
});

onMounted(async () => {
  await app.loadAll();
  if (route.params.id) {
    selectedChatId.value = String(route.params.id);
    await loadChat();
  }
});

watch(selectedChatId, async (id) => {
  if (id) {
    router.replace(`/chat/${id}`);
    await loadChat();
  }
});

async function loadChat() {
  if (!selectedChatId.value) return;
  await chat.loadChat(selectedChatId.value);
  showContext.value = false;
  contextPreview.value = null;
  const ch = app.chats.find((c) => c.id === selectedChatId.value);
  selectedBackground.value = ch?.background_id || '';
  if (ch?.mode === 'group') {
    const res = await api.get(`/api/groups/${ch.group_id}`);
    group.value = res.group;
    groupMembers.value = res.members || [];
    autoMode.value = res.group.settings?.autoMode || 'round-robin';
  } else {
    group.value = null;
    groupMembers.value = [];
    autoMode.value = 'round-robin';
  }
}

async function switchChat() {
  if (!selectedChatId.value) return;
  await loadChat();
}

async function setBackground() {
  if (!selectedChatId.value) return;
  const res = await api.patch(`/api/chats/${selectedChatId.value}`, { background_id: selectedBackground.value || null });
  const idx = app.chats.findIndex((c) => c.id === selectedChatId.value);
  if (idx >= 0) app.chats[idx] = res.chat;
}

async function createChat() {
  if (newMode.value === 'single' && !newCharacterId.value) return alert('请选择角色');
  if (newMode.value === 'group' && !newGroupId.value) return alert('请选择群聊');
  let chatData: any;
  if (newMode.value === 'single') {
    const char = app.characters.find((c) => c.id === newCharacterId.value);
    chatData = await api.post('/api/chats', {
      title: newTitle.value || char?.name || '新会话',
      mode: 'single',
      character_id: newCharacterId.value,
    });
    if (char?.first_mes) {
      await api.post(`/api/chats/${chatData.chat.id}/messages`, {
        role: 'assistant',
        character_id: char.id,
        content: char.first_mes,
      });
    }
  } else {
    const grp = app.groups.find((g) => g.id === newGroupId.value);
    chatData = await api.post('/api/chats', {
      title: newTitle.value || grp?.title || '新群聊',
      mode: 'group',
      group_id: newGroupId.value,
    });
    const firstMes = groupMembers.value.filter((m: any) => m.kind !== 'player' && m.kind !== 'gm');
    for (const m of firstMes) {
      const c = app.characters.find((x: any) => x.id === m.character_id);
      if (c?.first_mes) {
        await api.post(`/api/chats/${chatData.chat.id}/messages`, {
          role: 'assistant',
          character_id: c.id,
          content: c.first_mes,
        });
      }
    }
  }
  await app.refreshChats();
  selectedChatId.value = chatData.chat.id;
  showNew.value = false;
  await loadChat();
}

async function createGroup() {
  if (!groupTitle.value) return alert('请输入群聊名称');
  const res = await api.post('/api/groups', { title: groupTitle.value, settings: { enemyActionVisible: true, autoMode: 'round-robin' } });
  await app.refreshGroups();
  newGroupId.value = res.group.id;
  createGroupPanel.value = false;
  groupTitle.value = '';
  groupMembers.value = [];
}

async function addMember() {
  if (!newGroupId.value || !addCharId.value) return alert('请先创建群聊并选择角色');
  await api.post(`/api/groups/${newGroupId.value}/members`, {
    character_id: addCharId.value,
    kind: addCharKind.value,
  });
  const res = await api.get(`/api/groups/${newGroupId.value}`);
  groupMembers.value = res.members || [];
}

async function removeMember(id: string) {
  await api.del(`/api/group-members/${id}`);
  const res = await api.get(`/api/groups/${newGroupId.value || currentChat.value?.group_id}`);
  groupMembers.value = res.members || [];
}

async function updateMemberKind(m: any, kind: string) {
  const res = await api.patch(`/api/group-members/${m.id}`, { kind });
  Object.assign(m, res.member);
}

async function setAutoMode() {
  if (!group.value) return;
  const res = await api.patch(`/api/groups/${group.value.id}`, {
    settings: { ...(group.value.settings || {}), autoMode: autoMode.value },
  });
  group.value = res.group;
}

async function toggleEnemyVisible() {
  const visible = group.value.settings?.enemyActionVisible === false;
  const res = await api.patch(`/api/groups/${group.value.id}`, {
    settings: { ...(group.value.settings || {}), enemyActionVisible: visible },
  });
  group.value = res.group;
}

function memberName(id: string) {
  return app.characters.find((c) => c.id === id)?.name || id;
}
function memberKind(kind: string) {
  return ({ player: '玩家', companion: 'AI同伴', gm: 'GM', enemy: 'AI敌人' } as any)[kind] || kind;
}

function displayName(m: any) {
  if (m.role === 'user') return '你';
  if (m.character_id) return memberName(m.character_id);
  if (m.role === 'gm') return 'GM';
  return '助手';
}

function characterAvatar(id?: string) {
  if (!id) return '';
  const c = app.characters.find((x: any) => x.id === id);
  return c?.avatar_url || '';
}

async function loadContext() {
  if (!selectedChatId.value) return;
  try {
    const res = await api.post(`/api/chats/${selectedChatId.value}/context-preview`, {
      speakerId: currentChat.value?.mode === 'group' ? manualSpeaker.value || undefined : undefined,
    });
    contextPreview.value = res;
  } catch (e: any) {
    alert(e.message);
  }
}

async function toggleContext() {
  showContext.value = !showContext.value;
  if (showContext.value) await loadContext();
}

async function forkMessage(m: any) {
  const title = prompt('分支会话标题', (currentChat.value?.title || '会话') + ' (分支)');
  if (title === null) return;
  const res = await api.post(`/api/chats/${selectedChatId.value}/fork`, { fromMessageId: m.id, title });
  await app.refreshChats();
  selectedChatId.value = res.chat.id;
  await loadChat();
}

async function deleteAfter(m: any) {
  if (!confirm('确定删除该消息之后的所有消息？')) return;
  await api.post(`/api/messages/${m.id}/delete-after`);
  await chat.loadChat(selectedChatId.value);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendNow();
  }
}

function sendNow() {
  if (chat.generating) return;
  const text = inputText.value.trim();
  if (currentChat.value?.mode === 'group') {
    if (!text && !manualSpeaker.value) return;
    chat.sendGroup(manualSpeaker.value || '', text || undefined).then(() => {
      inputText.value = '';
      app.refreshChats();
    });
  } else {
    if (!text) return;
    chat.sendSingle(text).then(() => {
      inputText.value = '';
      app.refreshChats();
    });
  }
}

function sendGroupNow() {
  if (chat.generating) return;
  chat.sendGroup(manualSpeaker.value || '', undefined).then(() => app.refreshChats());
}

function startEdit(m: any) {
  editId.value = m.id;
  editContent.value = m.content;
}

async function toggleHidden(m: any) {
  const res = await api.patch(`/api/messages/${m.id}`, { visible_to_player: !m.visible_to_player });
  const idx = chat.messages.findIndex((x) => x.id === m.id);
  if (idx >= 0) chat.messages[idx] = res.message;
}

async function saveEdit(id: string) {
  await chat.editMessage(id, editContent.value);
  editId.value = '';
}
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-bottom: 70px;
}
.chat-header {
  position: sticky;
  top: 0;
  background: rgba(13, 13, 24, 0.78);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  z-index: 10;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.chat-header select {
  min-width: 0;
}
.group-panel {
  margin: 8px 0;
  font-size: 0.9rem;
}
.group-panel details {
  margin-top: 8px;
}
.group-panel summary {
  cursor: pointer;
  color: var(--muted);
  font-size: 0.84rem;
  user-select: none;
  transition: color 0.15s ease;
}
.group-panel summary:hover {
  color: var(--text);
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 4px;
}
.msg-actions {
  margin-top: 4px;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.message:hover .msg-actions,
.msg-actions:focus-within {
  opacity: 1;
  transform: none;
}
.hidden-tag {
  margin-left: 6px;
  color: var(--warn);
  font-size: 0.9em;
  padding: 0 6px;
  border: 1px solid rgba(255, 183, 77, 0.35);
  border-radius: 999px;
  background: rgba(255, 183, 77, 0.08);
}
.composer {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(74px + env(safe-area-inset-bottom, 0px));
  width: min(calc(100% - 24px), var(--max-width));
  display: flex;
  gap: 8px;
  align-items: stretch;
  padding: 10px;
  background: rgba(15, 16, 32, 0.88);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  z-index: 20;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.composer:focus-within {
  border-color: rgba(139, 124, 255, 0.45);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 3px rgba(139, 124, 255, 0.12);
}
.composer textarea {
  flex: 1;
  background: transparent;
  border: none;
  padding: 6px 4px;
}
.composer textarea:focus {
  box-shadow: none;
  background: transparent;
}
.composer button {
  align-self: stretch;
  min-width: 72px;
}
.context-panel {
  margin: 8px 0;
  max-height: 260px;
  overflow: auto;
  font-size: 0.75rem;
}
.context-panel pre {
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(9, 10, 22, 0.85);
  border: 1px solid var(--border);
  padding: 10px;
  border-radius: 8px;
  font-size: 0.72rem;
  line-height: 1.5;
}
.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--border);
}
.member-row select {
  width: auto;
  flex: 1;
  max-width: 140px;
}
.member-row button {
  padding: 4px 10px;
  font-size: 0.74rem;
  border-radius: 8px;
}
</style>
