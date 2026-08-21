<template>
  <div class="page">
    <div class="row">
      <h1>独立工具</h1>
    </div>

    <div class="card tool-card" style="margin-bottom: 16px">
      <div class="tool-head">
        <span class="tool-icon">🔊</span>
        <h3>语音合成（TTS）</h3>
      </div>
      <label>语音连接<span v-if="!ttsConns.length" class="warn">（未配置语音连接，请到 模型连接 中新建用途为"语音合成"的连接）</span></label>
      <select v-model="ttsConn">
        <option v-for="c in ttsConns" :key="c.id" :value="c.id">{{ c.name }} · {{ c.model }}</option>
      </select>
      <label>文本</label>
      <textarea v-model="ttsText" placeholder="要朗读的内容"></textarea>
      <label>音色（{{ ttsConnInfo?.name || '当前连接' }}）</label>
      <select v-model="ttsVoice">
        <option v-for="v in voiceOptions" :key="v.id" :value="v.id">{{ v.label }}</option>
      </select>
      <div class="row" style="margin-top: 10px">
        <button class="primary" :disabled="ttsBusy" @click="doTts">生成语音</button>
        <audio v-if="ttsUrl" :src="ttsUrl" controls style="flex: 1; min-width: 200px" />
      </div>
    </div>

    <div class="card tool-card">
      <div class="tool-head">
        <span class="tool-icon">🖼️</span>
        <h3>图片生成（OpenAI 兼容）</h3>
      </div>
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
import { computed, onMounted, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { api } from '@/api/client';

/** 阿里云百炼 Qwen-Audio-TTS 系统音色（qwen-audio-3.0-tts-flash） */
const DASHSCOPE_FLASH_VOICES = [
  { id: 'longanhuan_v3.6', label: '龙安欢 · 女 25 · 默认' },
  { id: 'longanfengyue', label: '龙安风悦 · 女 30 · 自然亲切' },
  { id: 'longanyuanfei', label: '龙安元妃 · 女 30 · 高傲妃子' },
  { id: 'longanlingxi', label: '龙安灵希 · 女 25 · 可爱甜美' },
  { id: 'longanxiaoxin', label: '龙安小昕 · 女 22 · 亲切活泼' },
  { id: 'longjielidou_v3.6', label: '龙杰力豆 · 男 5 · 天真男童' },
  { id: 'longpaopao_v3.6', label: '龙泡泡 · 女 5 · 软糯可爱' },
  { id: 'longhuohuo_v3.6', label: '龙火火 · 男 8 · 顽皮少年' },
  { id: 'longchuanshu_v3.6', label: '龙川叔 · 男 40 · 川普大叔' },
  { id: 'loongmary', label: 'loongmary · 女 20 · 温暖英音' },
  { id: 'loongeva_v3.6', label: 'loongeva · 女 28 · 高智美音' },
  { id: 'loongjohn', label: 'loongJohn · 男 28 · 沉稳美音' },
];

/** qwen-audio-3.0-tts-plus 额外系统音色 */
const DASHSCOPE_PLUS_VOICES = [
  ...DASHSCOPE_FLASH_VOICES,
  { id: 'longanlingxin', label: '龙安灵心 · 女 25 · 知心温暖' },
  { id: 'longanlufeng', label: '龙安鲁风 · 男 25 · 明亮开朗' },
];

/** OpenAI 兼容 TTS 标准音色 */
const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map((id) => ({
  id,
  label: id,
}));

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
const ttsConnInfo = computed(() => app.connections.find((c: any) => c.id === ttsConn.value) || null);

const voiceOptions = computed(() => {
  const conn = ttsConnInfo.value;
  if (conn?.provider === 'dashscope-tts') {
    return String(conn.model || '').includes('plus') ? DASHSCOPE_PLUS_VOICES : DASHSCOPE_FLASH_VOICES;
  }
  return OPENAI_VOICES;
});

// 切换连接时自动重置音色为该连接支持的默认音色
watch(ttsConn, () => {
  if (voiceOptions.value.length) ttsVoice.value = voiceOptions.value[0].id;
});

onMounted(async () => {
  await app.loadAll();
  if (ttsConns.value.length) {
    ttsConn.value = ttsConns.value[0].id;
    if (voiceOptions.value.length) ttsVoice.value = voiceOptions.value[0].id;
  }
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
.tool-card {
  padding-top: 16px;
}
.tool-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.tool-head h3 {
  margin: 0;
}
.tool-icon {
  font-size: 1.3rem;
  filter: drop-shadow(0 3px 8px rgba(233, 69, 96, 0.3));
}
.img-results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.img-result img {
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.img-result img:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}
.img-result button {
  margin-top: 6px;
  width: 100%;
}
</style>
