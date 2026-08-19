<template>
  <div class="page">
    <div class="row">
      <h1>世界书</h1>
      <span class="spacer" />
      <button @click="openNew">新建</button>
      <button @click="fileInput?.click()">导入</button>
      <input ref="fileInput" type="file" accept=".json" style="display: none" @change="importFile" />
    </div>

    <div class="wb-list">
      <div v-for="wb in app.worldbooks" :key="wb.id" class="card row">
        <div style="flex: 1">
          <strong>{{ wb.name }}</strong>
          <div class="muted">{{ wb.description }}</div>
        </div>
        <button @click="open(wb)">管理</button>
        <a :href="`/api/worldbooks/${wb.id}/export`" download>导出</a>
        <button @click="remove(wb.id)">删除</button>
      </div>
    </div>

    <div v-if="current" class="card" style="margin-top: 16px">
      <div class="row">
        <h3>{{ current.name }}</h3>
        <span class="spacer" />
        <button @click="showAi = !showAi">AI 生成条目</button>
        <button @click="current = null">关闭</button>
      </div>
      <label>名称</label>
      <input v-model="current.name" @change="saveMeta" />
      <label>描述</label>
      <textarea v-model="current.description" @change="saveMeta"></textarea>

      <div v-if="showAi" class="card" style="margin: 10px 0">
        <label>世界书生成提示</label>
        <textarea v-model="aiPrompt" placeholder="例如：为这个奇幻世界生成 10 个关于地理、组织、魔法体系的条目"></textarea>
        <button :disabled="aiBusy" @click="generateEntries">生成并追加</button>
      </div>

      <h4 style="margin-top: 14px">条目 ({{ entries.length }})</h4>
      <div v-for="e in entries" :key="e.id" class="entry card">
        <label>触发关键词（逗号分隔）</label>
        <input :value="(e.key || []).join(', ')" @change="updateEntryKey(e, ($event.target as HTMLInputElement).value)" />
        <label>内容</label>
        <textarea :value="e.content" @change="updateEntryContent(e, ($event.target as HTMLTextAreaElement).value)"></textarea>
        <div class="row">
          <label style="display: flex; align-items: center; gap: 6px">
            <input type="checkbox" :checked="Boolean(e.constant)" @change="updateEntry(e, { constant: ($event.target as HTMLInputElement).checked })" /> 常驻
          </label>
          <label style="display: flex; align-items: center; gap: 6px">
            <input type="checkbox" :checked="!e.enabled" @change="updateEntry(e, { enabled: !($event.target as HTMLInputElement).checked })" /> 禁用
          </label>
          <label style="flex: 1">概率 % <input type="number" min="0" max="100" :value="e.probability" @change="updateEntry(e, { probability: Number(($event.target as HTMLInputElement).value) })" /></label>
          <button @click="deleteEntry(e.id)">删除</button>
        </div>
      </div>
      <button style="margin-top: 10px" @click="addEntry">新增条目</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { api } from '@/api/client';

const app = useAppStore();
const current = ref<any>(null);
const entries = ref<any[]>([]);
const fileInput = ref<HTMLInputElement>();
const showAi = ref(false);
const aiPrompt = ref('');
const aiBusy = ref(false);

onMounted(() => app.loadAll());

function openNew() {
  current.value = { id: null, name: '新世界书', description: '' };
  entries.value = [];
}

async function open(wb: any) {
  const res = await api.get(`/api/worldbooks/${wb.id}`);
  current.value = { ...res.worldbook, id: res.worldbook.id };
  entries.value = res.entries || [];
}

async function saveMeta() {
  if (!current.value?.id) {
    const res = await api.post('/api/worldbooks', { name: current.value.name, description: current.value.description });
    current.value.id = res.worldbook.id;
    await app.refreshWorldbooks();
    return;
  }
  await api.put(`/api/worldbooks/${current.value.id}`, { name: current.value.name, description: current.value.description });
  await app.refreshWorldbooks();
}

async function addEntry() {
  if (!current.value?.id) await saveMeta();
  const res = await api.post(`/api/worldbooks/${current.value.id}/entries`, { key: [], content: '' });
  entries.value.push(res.entry);
}

async function updateEntry(e: any, patch: any) {
  const res = await api.put(`/api/worldbook-entries/${e.id}`, patch);
  Object.assign(e, res.entry);
}

async function updateEntryKey(e: any, text: string) {
  await updateEntry(e, { key: text.split(',').map((s) => s.trim()).filter(Boolean) });
}

async function updateEntryContent(e: any, content: string) {
  await updateEntry(e, { content });
}

async function deleteEntry(id: string) {
  if (!confirm('删除该条目？')) return;
  await api.del(`/api/worldbook-entries/${id}`);
  entries.value = entries.value.filter((e) => e.id !== id);
}

async function remove(id: string) {
  if (!confirm('确定删除该世界书？')) return;
  await api.del(`/api/worldbooks/${id}`);
  if (current.value?.id === id) current.value = null;
  await app.refreshWorldbooks();
}

async function importFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    await api.post('/api/worldbooks/import', { json: JSON.parse(text) });
    await app.refreshWorldbooks();
    alert('导入成功');
  } catch (err: any) {
    alert('导入失败：' + err.message);
  } finally {
    input.value = '';
  }
}

async function generateEntries() {
  if (!aiPrompt.value) return;
  aiBusy.value = true;
  try {
    const res = await api.post('/api/worldbooks/ai/generate', { prompt: aiPrompt.value });
    if (!current.value?.id) await saveMeta();
    for (const d of res.draft || []) {
      await api.post(`/api/worldbooks/${current.value.id}/entries`, d);
    }
    const data = await api.get(`/api/worldbooks/${current.value.id}`);
    entries.value = data.entries || [];
    showAi.value = false;
  } catch (err: any) {
    alert(err.message);
  } finally {
    aiBusy.value = false;
  }
}
</script>

<style scoped>
.wb-list {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}
.entry {
  margin-top: 10px;
}
</style>
