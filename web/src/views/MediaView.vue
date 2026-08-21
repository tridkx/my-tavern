<template>
  <div class="page">
    <div class="row">
      <h1>资源库</h1>
      <span class="spacer" />
      <button @click="showUpload = true">上传</button>
      <button @click="showUrl = true">添加 URL</button>
    </div>

    <div class="tabs row">
      <button v-for="k in kinds" :key="k" :class="{ primary: kind === k }" @click="kind = k">{{ labels[k] }}</button>
    </div>

    <div v-if="showUpload" class="card" style="margin-top: 12px">
      <h3>上传文件</h3>
      <label>资源类型</label>
      <select v-model="uploadKind">
        <option v-for="k in kinds" :key="k" :value="k">{{ labels[k] }}</option>
      </select>
      <label>名称（可选）</label>
      <input v-model="uploadName" />
      <input ref="fileInput" type="file" style="margin-top: 8px" />
      <div class="row" style="margin-top: 10px">
        <button class="primary" @click="upload">上传</button>
        <button @click="showUpload = false">取消</button>
      </div>
    </div>

    <div v-if="showUrl" class="card" style="margin-top: 12px">
      <h3>添加 URL</h3>
      <label>资源类型</label>
      <select v-model="urlKind">
        <option v-for="k in kinds" :key="k" :value="k">{{ labels[k] }}</option>
      </select>
      <label>URL</label>
      <input v-model="urlValue" placeholder="https://..." />
      <div class="row" style="margin-top: 10px">
        <button class="primary" @click="addUrl">添加</button>
        <button @click="showUrl = false">取消</button>
      </div>
    </div>

    <div class="media-grid">
      <div v-for="m in filtered" :key="m.id" class="card media-card">
        <div class="media-thumb">
          <img v-if="isImage(m)" :src="m.url || m.file_path" />
          <audio v-else-if="m.kind === 'voice'" :src="m.url" controls class="voice-audio" />
          <div v-else class="voice-box">🎵</div>
        </div>
        <div class="media-name">{{ m.name }}</div>
        <div class="row media-actions">
          <button class="sm" @click="copyUrl(m)">复制</button>
          <button class="sm danger" @click="remove(m.id)">删除</button>
        </div>
      </div>
    </div>
    <p v-if="!filtered.length" class="empty">
      <span class="empty-icon">🖼️</span>
      这个分类下还没有资源
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { api } from '@/api/client';

const app = useAppStore();
const kind = ref('image');
const showUpload = ref(false);
const showUrl = ref(false);
const uploadKind = ref('image');
const uploadName = ref('');
const urlKind = ref('image');
const urlValue = ref('');
const fileInput = ref<HTMLInputElement>();

const kinds = ['background', 'avatar', 'image', 'voice'];
const labels: Record<string, string> = {
  background: '背景图',
  avatar: '头像',
  image: '图片',
  voice: '语音',
};

const filtered = computed(() => app.media.filter((m) => m.kind === kind.value));

onMounted(() => app.loadAll());

function isImage(m: any) {
  return m.kind !== 'voice';
}

async function upload() {
  const file = fileInput.value?.files?.[0];
  if (!file) return alert('请选择文件');
  const fd = new FormData();
  fd.append('kind', uploadKind.value);
  fd.append('name', uploadName.value);
  fd.append('file', file);
  const res = await fetch('/api/media/upload', { method: 'POST', credentials: 'include', body: fd });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return alert(data.error || '上传失败');
  }
  showUpload.value = false;
  uploadName.value = '';
  await app.refreshMedia();
}

async function addUrl() {
  if (!urlValue.value) return;
  await api.post('/api/media/from-url', { kind: urlKind.value, url: urlValue.value });
  showUrl.value = false;
  urlValue.value = '';
  await app.refreshMedia();
}

async function remove(id: string) {
  if (!confirm('确定删除？')) return;
  await api.del(`/api/media/${id}`);
  await app.refreshMedia();
}

async function copyUrl(m: any) {
  const raw = m.url || m.file_path || '';
  const url = /^https?:\/\//i.test(raw) ? raw : window.location.origin + raw;
  try {
    await navigator.clipboard.writeText(url);
    alert('已复制');
  } catch {
    prompt('复制链接', url);
  }
}
</script>

<style scoped>
.tabs {
  margin: 12px 0;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  background: rgba(9, 10, 22, 0.6);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 4px;
}
.tabs button {
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 7px 14px;
  font-size: 0.82rem;
  border-radius: 9px;
}
.tabs button:hover {
  transform: none;
  background: rgba(124, 128, 190, 0.14);
}
.tabs button.primary {
  box-shadow: 0 2px 10px rgba(233, 69, 96, 0.35);
}
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.media-card {
  padding: 10px;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.media-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-lg);
}
.media-thumb {
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(9, 10, 22, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}
.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s ease;
}
.media-card:hover .media-thumb img {
  transform: scale(1.05);
}
.voice-box {
  font-size: 2rem;
  opacity: 0.6;
}
.voice-audio {
  width: 100%;
}
.media-name {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.media-actions {
  margin-top: 6px;
  gap: 6px;
}
</style>
