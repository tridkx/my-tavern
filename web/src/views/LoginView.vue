<template>
  <div class="login-page">
    <div class="login-glow" aria-hidden="true"></div>
    <div class="card login-card">
      <div class="logo">🍺</div>
      <h1>MyTavern</h1>
      <p class="muted tagline">精简版酒馆 · 公网部署已开启访问口令保护</p>
      <form @submit.prevent="submit">
        <label>访问口令</label>
        <input v-model="token" type="password" placeholder="输入 ACCESS_TOKEN" autofocus />
        <div class="row" style="margin-top: 16px">
          <button class="primary" style="flex: 1" :disabled="loading">
            {{ loading ? '进入中…' : '进入酒馆' }}
          </button>
        </div>
        <p v-if="error" class="login-error">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const token = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.value }),
    });
    const data = await res.json();
    if (!res.ok || !data.authenticated) {
      error.value = data.error || '登录失败';
      return;
    }
    router.push('/chat');
  } catch (e: any) {
    error.value = e.message || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* 背后的一圈暖光，营造酒馆烛光氛围 */
.login-glow {
  position: absolute;
  width: 560px;
  height: 560px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 45%, rgba(255, 200, 107, 0.12), transparent 55%),
    radial-gradient(circle at 50% 50%, rgba(233, 69, 96, 0.14), transparent 62%);
  filter: blur(10px);
  pointer-events: none;
}

.login-card {
  width: 100%;
  max-width: 380px;
  text-align: center;
  padding: 40px 30px;
  animation: cardIn 0.4s cubic-bezier(0.21, 0.9, 0.35, 1);
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.login-card .logo {
  font-size: 3rem;
  line-height: 1;
  margin-bottom: 12px;
  filter: drop-shadow(0 8px 22px rgba(233, 69, 96, 0.45));
  animation: floatY 3.2s ease-in-out infinite;
}

.login-card h1 {
  margin: 0 0 6px;
  font-size: 1.8rem;
  letter-spacing: 0.04em;
}

.login-card .tagline {
  margin: 0 0 20px;
  font-size: 0.84rem;
}

.login-error {
  color: var(--warn);
  font-size: 0.85rem;
  margin: 12px 0 0;
}
</style>
