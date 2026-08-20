<template>
  <div class="page">
    <div class="row">
      <h1>独立工具</h1>
    </div>

    <div class="card" style="margin-bottom: 16px">
      <h3>🔊 语音合成（TTS）</h3>
      <label>语音连接<span v-if="!ttsConns.length" class="warn">（未配置语音连接，请到 模型连接 中新建用途为"语音合成"的连接）</span></label>
      <select v-model="ttsConn">
        <option v-for="c in ttsConns" :key="c.id" :value="c.id">{{ c.name }} · {{ c.model }}</option>
      </select>
      <label>文本</label>
      <textarea v-model="ttsText" placeholder="要朗读的内容"></textarea>
      <label>音色</label>
      <input v-model="ttsVoice" placeholder="alloy / echo / fable / onyx / nova / shimmer" />
      <div class="row" style="margin-top: 10px">
        <button class="primary" :disabled="ttsBusy" @click="doTts">生成语音</button>
        <audio v-if="ttsUrl" :src="ttsUrl" controls style="flex: 1; min-width: 200px" />
      </div>
    </div>

    <div class="card">
      <h3>🖼️ 图片生成（OpenAI 兼容）</h3>
      <label>图片连接<span v-if="!imgConns.length" class="warn">（未配置图片连接，请到 模型连接 中新建用途为"图片生成"的连接）</span></label>
      <select v-model="imgConn">
        <option v-for="c in imgConns" :key="c.id" :value="c.id">{{ c.name }} · {{ c.model }}</option>
      </select>
      <label>提示词</label>
      <textarea v-model="imgPrompt" placeholder="A fantasy tavern interior, cozy, warm light"></textarea>
      <div class="row">
        <label style="flex: 1">尺寸
          <select v-model="imgSize">
            <option>1024x1024</option><option>512x512</option><option>256x256</option><option>1792x1024</option><option>1024x1792</option>
          </select>
        </label>
        <label style="flex: 1">数量
          <input v-model.number="imgN" type="number" min="1" max="4" />
        </label>
      </div>
      <div class="row" style="margin-top: 10px">
        <button class="primary" :disabled="imgBusy" @click="doImage">生成图片</button>
      </div>
      <div class="img-results">
        <div v-for="(img, i) in imgResults" :key="i" class="img-result">
          <img :src="img.url || (img.b64_json ? `data:image/png;base64,${img.b64_json}` : '')" />
          <button v-if="img.url" @click="saveImage(img.url)">保存到资源库</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { api } from '@/api/client';

const app = useAppStore();
const ttsConn = ref('');
const ttsText = ref('');
const ttsVoice = ref('alloy');
const ttsUrl = ref('');
const ttsBusy = ref(false);

const imgConn = ref('');
const imgPrompt = ref('');
const imgSize = ref('1024x1024');
const imgN = ref(1);
const imgResults = ref<any[]>([]);
const imgBusy = ref(false);

const ttsConns = computed(() => app.connections.filter((c: any) => c.type === 'tts'));
const imgConns = computed(() => app.connections.filter((c: any) => c.type === 'image'));

onMounted(async () => {
  await app.loadAll();
  if (ttsConns.value.length) ttsConn.value = ttsConns.value[0].id;
  if (imgConns.value.length) imgConn.value = imgConns.value[0].id;
});

async function doTts() {
  if (!ttsText.value) return alert('请输入文本');
  ttsBusy.value = true;
  ttsUrl.value = '';
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: ttsText.value, connectionId: ttsConn.value, voice: ttsVoice.value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || '生成失败');
    }
    const blob = await res.blob();
    ttsUrl.value = URL.createObjectURL(blob);
  } catch (e: any) {
    alert(e.message);
  } finally {
    ttsBusy.value = false;
  }
}

async function doImage() {
  if (!imgPrompt.value) return alert('请输入提示词');
  imgBusy.value = true;
  try {
    const res = await api.post('/api/images/generate', {
      prompt: imgPrompt.value,
      connectionId: imgConn.value,
      size: imgSize.value,
      n: imgN.value,
    });
    imgResults.value = res.data || [];
  } catch (e: any) {
    alert(e.message);
  } finally {
    imgBusy.value = false;
  }
}

async function saveImage(url: string) {
  try {
    await api.post('/api/media/from-url', { kind: 'image', name: imgPrompt.value.slice(0, 30), url });
    await app.refreshMedia();
    alert('已保存');
  } catch (e: any) {
    alert(e.message);
  }
}
</script>

<style scoped>
.img-results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.img-result img {
  width: 100%;
  border-radius: 8px;
}
.img-result button {
  margin-top: 6px;
  width: 100%;
}
</style>
