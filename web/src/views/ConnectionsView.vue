<template>
  <div class="page">
    <div class="row">
      <h1>模型连接</h1>
      <span class="spacer" />
      <button class="primary" @click="openNew">新建</button>
    </div>

    <div class="card" style="margin: 12px 0">
      <h3>提供商预设</h3>
      <div class="preset-grid">
        <button v-for="p in app.providers" :key="p.id" @click="applyPreset(p)">
          {{ p.name }}
        </button>
      </div>
    </div>

    <div v-if="editing" class="card" style="margin: 12px 0">
      <h3>{{ editing.id ? '编辑连接' : '新建连接' }}</h3>
      <label>用途（决定该连接用于对话 / 语音 / 图片）</label>
      <select v-model="form.type">
        <option value="llm">对话 LLM（聊天、角色扮演）</option>
        <option value="tts">语音合成 TTS（文字转语音）</option>
        <option value="image">图片生成（文生图）</option>
      </select>
      <label>名称</label>
      <input v-model="form.name" />
      <label>API 地址 (OpenAI 兼容)</label>
      <input v-model="form.base_url" placeholder="https://api.example.com/v1" />
      <label>API Key（留空则使用环境变量/保留原值）</label>
      <input v-model="form.api_key" type="password" autocomplete="off" />
      <label>API Key 环境变量名</label>
      <input v-model="form.api_key_env" placeholder="DEEPSEEK_API_KEY" />
      <label>模型名</label>
      <input v-model="form.model" />
      <div class="row">
        <label style="flex: 1">上下文长度<input v-model.number="form.context_window" type="number" /></label>
        <label style="flex: 1">最大输出 Tokens<input v-model.number="form.max_tokens" type="number" /></label>
      </div>
      <div class="row">
        <label style="flex: 1">Temperature<input v-model.number="form.temperature" type="number" step="0.1" min="0" max="2" /></label>
        <label style="flex: 1">Top P<input v-model.number="form.top_p" type="number" step="0.05" min="0" max="1" /></label>
      </div>
      <div class="row">
        <label style="flex: 1">Top K（可选）<input v-model.number="form.top_k" type="number" min="1" /></label>
        <label style="flex: 1">Frequency Penalty<input v-model.number="form.frequency_penalty" type="number" step="0.1" min="-2" max="2" /></label>
      </div>
      <div class="row">
        <label style="flex: 1">Presence Penalty<input v-model.number="form.presence_penalty" type="number" step="0.1" min="-2" max="2" /></label>
      </div>
      <label>停止序列（逗号分隔，可选）</label>
      <input v-model="stopText" placeholder="END, STOP" />
      <label>Extra Headers（JSON，可选）</label>
      <textarea v-model="extraHeadersText" rows="3" placeholder='{"X-Tag":"value"}'></textarea>
      <label style="margin-top: 8px; display: flex; gap: 8px; align-items: center">
        <input v-model="form.is_default" type="checkbox" style="width: auto" /> 设为默认连接
      </label>
      <div class="row" style="margin-top: 14px">
        <button class="primary" @click="save">保存</button>
        <button @click="editing = null">取消</button>
      </div>
    </div>

    <div class="card-list">
      <div v-for="c in app.connections" :key="c.id" class="card list-card row">
        <div style="flex: 1; min-width: 0">
          <strong>{{ c.name }}</strong>
          <span class="type-tag" :class="c.type">{{ typeLabel(c.type) }}</span>
          <span v-if="c.is_default" class="chip default-chip">默认</span>
          <div class="muted conn-meta">{{ c.provider }} · {{ c.model }}</div>
          <div class="muted conn-meta">{{ c.base_url }}</div>
          <div class="muted conn-meta">Key: {{ c.has_api_key ? '已配置' : '未配置' }}</div>
        </div>
        <button class="sm" @click="edit(c)">编辑</button>
        <button class="sm danger" @click="remove(c.id)">删除</button>
      </div>
    </div>
    <p v-if="!app.connections.length" class="empty">
      <span class="empty-icon">🔌</span>
      还没有模型连接，点击上方预设快速创建
    </p>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { api } from '@/api/client';

const app = useAppStore();
const editing = ref<any>(null);
const stopText = ref('');
const extraHeadersText = ref('');
const form = reactive<any>({
  name: '',
  type: 'llm',
  provider: 'custom',
  base_url: '',
  api_key: '',
  api_key_env: '',
  model: '',
  context_window: 8192,
  max_tokens: 2048,
  temperature: 0.8,
  top_p: 1,
  top_k: null,
  frequency_penalty: 0,
  presence_penalty: 0,
  stop_sequences: [],
  extra_headers: {},
  is_default: false,
});

onMounted(() => app.loadAll());

function resetForm() {
  Object.assign(form, {
    name: '',
    type: 'llm',
    provider: 'custom',
    base_url: '',
    api_key: '',
    api_key_env: '',
    model: '',
    context_window: 8192,
    max_tokens: 2048,
    temperature: 0.8,
    top_p: 1,
    top_k: null,
    frequency_penalty: 0,
    presence_penalty: 0,
    stop_sequences: [],
    extra_headers: {},
    is_default: false,
  });
  stopText.value = '';
  extraHeadersText.value = '';
}

function openNew() {
  resetForm();
  editing.value = { id: null };
}

function applyPreset(p: any) {
  resetForm();
  Object.assign(form, {
    name: p.name,
    type: p.types?.[0] || 'llm',
    provider: p.id,
    base_url: p.baseUrl,
    api_key: '',
    api_key_env: p.apiKeyEnv || '',
    model: p.models?.[0]?.id || '',
    context_window: p.models?.[0]?.contextWindow || 8192,
    max_tokens: p.models?.[0]?.maxTokens || 2048,
    temperature: 0.8,
    top_p: 1,
  });
  editing.value = { id: null };
}

function edit(c: any) {
  Object.assign(form, {
    name: c.name,
    type: c.type || 'llm',
    provider: c.provider,
    base_url: c.base_url,
    api_key: '',
    api_key_env: c.api_key_env || '',
    model: c.model,
    context_window: c.context_window,
    max_tokens: c.max_tokens,
    temperature: c.temperature,
    top_p: c.top_p,
    top_k: c.top_k ?? null,
    frequency_penalty: c.frequency_penalty ?? 0,
    presence_penalty: c.presence_penalty ?? 0,
    stop_sequences: c.stop_sequences || [],
    extra_headers: c.extra_headers || {},
    is_default: Boolean(c.is_default),
  });
  stopText.value = (c.stop_sequences || []).join(', ');
  extraHeadersText.value = JSON.stringify(c.extra_headers || {}, null, 2);
  editing.value = { id: c.id };
}

async function save() {
  let extraHeaders: Record<string, string> = {};
  if (extraHeadersText.value.trim()) {
    try {
      const parsed = JSON.parse(extraHeadersText.value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
      extraHeaders = parsed;
      for (const key of Object.keys(extraHeaders)) {
        if (typeof extraHeaders[key] !== 'string') extraHeaders[key] = String(extraHeaders[key]);
      }
    } catch {
      alert('Extra Headers 必须是 JSON 对象');
      return;
    }
  }
  const payload: any = {
    ...form,
    stop_sequences: stopText.value.split(',').map((s) => s.trim()).filter(Boolean),
    extra_headers: extraHeaders,
    is_default: Boolean(form.is_default),
  };
  if (payload.top_k === '' || payload.top_k === null || payload.top_k === undefined) payload.top_k = null;
  if (payload.frequency_penalty === '') payload.frequency_penalty = 0;
  if (payload.presence_penalty === '') payload.presence_penalty = 0;
  if (!payload.api_key) delete payload.api_key;
  if (editing.value.id) {
    await api.put(`/api/connections/${editing.value.id}`, payload);
  } else {
    await api.post('/api/connections', payload);
  }
  editing.value = null;
  await app.refreshConnections();
}

async function remove(id: string) {
  if (!confirm('确定删除该连接？')) return;
  await api.del(`/api/connections/${id}`);
  await app.refreshConnections();
}

function typeLabel(t: string) {
  return { llm: '对话', tts: '语音', image: '图片' }[t] || t;
}
</script>

<style scoped>
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.preset-grid button {
  padding: 8px 10px;
  font-size: 0.82rem;
  border-radius: var(--radius-sm);
}
.card-list {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}
.type-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 9px;
  border-radius: 999px;
  font-size: 0.72rem;
  vertical-align: 2px;
  background: rgba(124, 128, 190, 0.16);
  border: 1px solid rgba(124, 128, 190, 0.3);
  color: #cfd6e4;
}
.type-tag.tts {
  background: rgba(76, 175, 80, 0.14);
  border-color: rgba(76, 175, 80, 0.4);
  color: #7ee2a8;
}
.type-tag.image {
  background: rgba(139, 124, 255, 0.14);
  border-color: rgba(139, 124, 255, 0.4);
  color: #d0b3ff;
}
.default-chip {
  margin-left: 6px;
  vertical-align: 2px;
  background: rgba(255, 200, 107, 0.12);
  border-color: rgba(255, 200, 107, 0.35);
  color: var(--gold);
}
.conn-meta {
  font-size: 0.78rem;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
