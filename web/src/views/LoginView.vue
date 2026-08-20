<template>
  <div class="login-page">
    <div class="card login-card">
      <div class="logo">🍺</div>
      <h1>MyTavern</h1>
      <p class="muted tagline">精简版酒馆 · 公网部署已开启访问口令保护</p>
      <form @submit.prevent="submit">
        <label>访问口令</label>
        <input v-model="token" type="password" placeholder="输入 ACCESS_TOKEN" autofocus />
        <div class="row" style="margin-top: 16px">
          <button class="primary" style="flex: 1" :disabled="loading">{{ loading ? '进入中…' : '进入酒馆' }}</button>
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
}
.login-card {
  width: 100%;
  max-width: 380px;
  text-align: center;
  padding: 36px 28px;
}
.login-card .logo {
  font-size: 2.6rem;
  line-height: 1;
  margin-bottom: 10px;
  filter: drop-shadow(0 6px 18px rgba(233, 69, 96, 0.35));
}
.login-card h1 {
  margin: 0 0 6px;
  font-size: 1.7rem;
}
.login-card .tagline {
  margin: 0 0 18px;
}
.login-error {
  color: var(--warn);
  font-size: 0.85rem;
  margin: 12px 0 0;
}
</style>
