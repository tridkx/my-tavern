<template>
  <div class="page">
    <div class="row">
      <h1>角色卡</h1>
      <span class="spacer" />
      <button @click="runAi('generate')">✨ AI 生成</button>
      <button @click="openNew">新建</button>
      <button @click="fileInput?.click()">导入</button>
      <input ref="fileInput" type="file" accept=".json,.png,.webp" style="display: none" @change="importFile" />
    </div>

    <div v-if="aiPanel" class="card" style="margin: 12px 0">
      <h3>{{ aiMode === 'generate' ? 'AI 生成角色' : 'AI 润色角色' }}</h3>
      <label>提示 / 要求</label>
      <textarea v-model="aiPrompt" placeholder="例如：一位神秘的地下酒馆老板娘，毒舌但心软……"></textarea>
      <div class="row" style="margin-top: 10px">
        <button class="primary" :disabled="aiBusy" @click="executeAi">生成</button>
        <button @click="aiPanel = false">关闭</button>
      </div>
    </div>

    <div v-if="editing" class="card" style="margin: 12px 0">
      <div class="row">
        <h3>{{ editing.id ? '编辑角色' : '新建角色' }}</h3>
        <span class="spacer" />
        <button @click="runAi('polish')">AI 润色</button>
      </div>
      <label>名称</label>
      <input v-model="form.name" />
      <label>类型</label>
      <select v-model="form.kind">
        <option value="general">通用（可选世界书）</option>
        <option value="special">专用（绑定世界书）</option>
      </select>
      <label>绑定世界书</label>
      <select v-model="form.worldbook_id">
        <option value="">不绑定</option>
        <option v-for="w in app.worldbooks" :key="w.id" :value="w.id">{{ w.name }}</option>
      </select>
      <label>模型连接</label>
      <select v-model="form.connection_id">
        <option value="">使用默认</option>
        <option v-for="c in app.connections" :key="c.id" :value="c.id">{{ c.name }} · {{ c.model }}</option>
      </select>
      <label>描述</label>
      <textarea v-model="form.description"></textarea>
      <label>性格</label>
      <textarea v-model="form.personality"></textarea>
      <label>场景</label>
      <textarea v-model="form.scenario"></textarea>
      <label>开场白 first_mes</label>
      <textarea v-model="form.first_mes"></textarea>
      <label>示例对话</label>
      <textarea v-model="form.mes_example"></textarea>
      <label>系统提示</label>
      <textarea v-model="form.system_prompt"></textarea>
      <label>回复后置要求</label>
      <textarea v-model="form.post_history_instructions"></textarea>
      <div class="row">
        <label style="flex: 1">作者<input v-model="form.creator" /></label>
        <label style="flex: 1">版本<input v-model="form.version" /></label>
      </div>
      <label>标签（逗号分隔）</label>
      <input v-model="tagsText" placeholder="奇幻, 冒险" />
      <div class="row" style="margin-top: 14px">
        <button class="primary" @click="save">保存</button>
        <button @click="editing = null">取消</button>
      </div>
    </div>

    <div class="char-list">
      <div v-for="c in app.characters" :key="c.id" class="card list-card char-card">
        <div class="avatar">
          <img v-if="c.avatar_url" :src="c.avatar_url" />
          <span v-else>{{ c.name.slice(0, 1) }}</span>
        </div>
        <div class="char-info">
          <strong>{{ c.name }}</strong>
          <span class="chip kind-chip">{{ c.kind === 'special' ? '专用' : '通用' }}</span>
          <div class="tags">
            <span v-for="t in c.tags || []" :key="t" class="chip">{{ t }}</span>
            <span v-if="!c.tags?.length" class="muted no-tag">无标签</span>
          </div>
        </div>
        <div class="char-actions">
          <a class="sm-link" :href="`/api/characters/${c.id}/export`" download>JSON</a>
          <a class="sm-link" :href="`/api/characters/${c.id}/export-image`" download>PNG卡</a>
          <button class="sm" @click="edit(c)">编辑</button>
          <button class="sm danger" @click="remove(c.id)">删除</button>
        </div>
      </div>
    </div>
    <p v-if="!app.characters.length" class="empty">
      <span class="empty-icon">🎭</span>
      暂无角色，点击"新建"或"AI 生成"
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { api } from '@/api/client';

const app = useAppStore();
const editing = ref<any>(null);
const fileInput = ref<HTMLInputElement>();
const tagsText = ref('');
const aiPanel = ref(false);
const aiMode = ref<'generate' | 'polish'>('generate');
const aiPrompt = ref('');
const aiBusy = ref(false);

const form = reactive<any>({
  name: '',
  kind: 'general',
  worldbook_id: '',
  connection_id: '',
  description: '',
  personality: '',
  scenario: '',
  first_mes: '',
  mes_example: '',
  system_prompt: '',
  post_history_instructions: '',
  creator: '',
  version: '1.0',
  tags: [],
});

onMounted(() => app.loadAll());

function openNew() {
  Object.assign(form, {
    name: '',
    kind: 'general',
    worldbook_id: '',
    connection_id: '',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    creator: '',
    version: '1.0',
    tags: [],
  });
  tagsText.value = '';
  editing.value = { id: null };
}

function edit(c: any) {
  Object.assign(form, {
    name: c.name,
    kind: c.kind,
    worldbook_id: c.worldbook_id || '',
    connection_id: c.connection_id || '',
    description: c.description || '',
    personality: c.personality || '',
    scenario: c.scenario || '',
    first_mes: c.first_mes || '',
    mes_example: c.mes_example || '',
    system_prompt: c.system_prompt || '',
    post_history_instructions: c.post_history_instructions || '',
    creator: c.creator || '',
    version: c.version || '1.0',
    tags: c.tags || [],
  });
  tagsText.value = (c.tags || []).join(', ');
  editing.value = { id: c.id };
}

async function save() {
  const payload = {
    ...form,
    worldbook_id: form.worldbook_id || null,
    connection_id: form.connection_id || null,
    tags: tagsText.value.split(',').map((s: string) => s.trim()).filter(Boolean),
  };
  if (editing.value.id) {
    await api.put(`/api/characters/${editing.value.id}`, payload);
  } else {
    await api.post('/api/characters', payload);
  }
  editing.value = null;
  await app.refreshCharacters();
}

async function remove(id: string) {
  if (!confirm('确定删除？')) return;
  await api.del(`/api/characters/${id}`);
  await app.refreshCharacters();
}

async function importFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.json')) {
      const text = await file.text();
      await api.post('/api/characters/import', { json: JSON.parse(text) });
    } else {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/characters/import-file', { method: 'POST', credentials: 'include', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '导入失败');
      }
    }
    await app.refreshCharacters();
    alert('导入成功');
  } catch (err: any) {
    alert('导入失败：' + err.message);
  } finally {
    input.value = '';
  }
}

function runAi(mode: 'generate' | 'polish' = 'generate') {
  if (mode === 'polish' && !editing.value?.id) {
    alert('请先保存角色，再使用 AI 润色');
    return;
  }
  aiMode.value = mode;
  aiPanel.value = true;
  aiPrompt.value = mode === 'polish' ? '请让文笔更生动，人设更鲜明。' : '';
}

async function executeAi() {
  aiBusy.value = true;
  try {
    if (aiMode.value === 'generate') {
      const res = await api.post('/api/characters/ai/generate', { prompt: aiPrompt.value });
      const d = res.draft;
      Object.assign(form, {
        name: d.name || '',
        kind: 'general',
        description: d.description || '',
        personality: d.personality || '',
        scenario: d.scenario || '',
        first_mes: d.first_mes || '',
        mes_example: d.mes_example || '',
        system_prompt: d.system_prompt || '',
        post_history_instructions: d.post_history_instructions || '',
        tags: d.tags || [],
      });
      tagsText.value = (d.tags || []).join(', ');
      editing.value = { id: null };
    } else {
      const res = await api.post(`/api/characters/${editing.value.id}/ai/polish`, { instruction: aiPrompt.value });
      const d = res.draft;
      Object.assign(form, {
        name: d.name || form.name,
        description: d.description || form.description,
        personality: d.personality || form.personality,
        scenario: d.scenario || form.scenario,
        first_mes: d.first_mes || form.first_mes,
        mes_example: d.mes_example || form.mes_example,
        system_prompt: d.system_prompt || form.system_prompt,
        post_history_instructions: d.post_history_instructions || form.post_history_instructions,
        tags: d.tags || form.tags,
      });
      tagsText.value = (d.tags || form.tags || []).join(', ');
    }
    aiPanel.value = false;
  } catch (e: any) {
    alert(e.message);
  } finally {
    aiBusy.value = false;
  }
}
</script>

<style scoped>
.char-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 12px;
}
@media (min-width: 720px) {
  .char-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
.char-card {
  display: flex;
  align-items: center;
  gap: 12px;
}
.char-info {
  flex: 1;
  min-width: 0;
}
.kind-chip {
  margin-left: 8px;
  vertical-align: 1px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.no-tag {
  font-size: 0.76rem;
}
.avatar {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 50%;
  background: var(--accent-grad);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-weight: bold;
  box-shadow: 0 0 0 2px rgba(139, 124, 255, 0.25), 0 4px 12px rgba(108, 92, 231, 0.3);
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.char-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.sm-link {
  font-size: 0.74rem;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(124, 128, 190, 0.08);
  color: var(--muted);
  transition: all 0.18s ease;
}
.sm-link:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: rgba(124, 128, 190, 0.17);
}
</style>
