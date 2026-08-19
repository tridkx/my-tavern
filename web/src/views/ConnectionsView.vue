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
      <label style="margin-top: 8px; display: flex; gap: 8px; align-items: center">
        <input v-model="form.is_default" type="checkbox" style="width: auto" /> 设为默认连接
      </label>
      <div class="row" style="margin-top: 14px">
        <button class="primary" @click="save">保存</button>
        <button @click="editing = null">取消</button>
      </div>
    </div>

    <div class="card-list">
      <div v-for="c in app.connections" :key="c.id" class="card row">
        <div style="flex: 1">
          <strong>{{ c.name }}</strong>
          <div class="muted">{{ c.provider }} · {{ c.model }} · {{ c.base_url }}</div>
          <div class="muted">Key: {{ c.has_api_key ? '已配置' : '未配置' }} {{ c.is_default ? ' · 默认' : '' }}</div>
        </div>
        <button @click="edit(c)">编辑</button>
        <button @click="remove(c.id)">删除</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { api } from '@/api/client';

const app = useAppStore();
const editing = ref<any>(null);
const form = reactive<any>({
  name: '',
  provider: 'custom',
  base_url: '',
  api_key: '',
  api_key_env: '',
  model: '',
  context_window: 8192,
  max_tokens: 2048,
  temperature: 0.8,
  top_p: 1,
  is_default: false,
});

onMounted(() => app.loadAll());

function openNew() {
  Object.assign(form, {
    name: '',
    provider: 'custom',
    base_url: '',
    api_key: '',
    api_key_env: '',
    model: '',
    context_window: 8192,
    max_tokens: 2048,
    temperature: 0.8,
    top_p: 1,
    is_default: false,
  });
  editing.value = { id: null };
}

function applyPreset(p: any) {
  Object.assign(form, {
    name: p.name,
    provider: p.id,
    base_url: p.baseUrl,
    api_key: '',
    api_key_env: p.apiKeyEnv || '',
    model: p.models?.[0]?.id || '',
    context_window: p.models?.[0]?.contextWindow || 8192,
    max_tokens: p.models?.[0]?.maxTokens || 2048,
    temperature: 0.8,
    top_p: 1,
    is_default: false,
  });
  editing.value = { id: null };
}

function edit(c: any) {
  Object.assign(form, {
    name: c.name,
    provider: c.provider,
    base_url: c.base_url,
    api_key: '',
    api_key_env: c.api_key_env || '',
    model: c.model,
    context_window: c.context_window,
    max_tokens: c.max_tokens,
    temperature: c.temperature,
    top_p: c.top_p,
    is_default: Boolean(c.is_default),
  });
  editing.value = { id: c.id };
}

async function save() {
  const payload: any = { ...form, is_default: Boolean(form.is_default) };
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
</script>

<style scoped>
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.card-list {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}
</style>
