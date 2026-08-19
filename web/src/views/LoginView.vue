<template>
  <div class="login-page">
    <div class="card login-card">
      <h1>MyTavern</h1>
      <p class="muted">精简版酒馆 · 公网部署已开启访问口令保护</p>
      <form @submit.prevent="submit">
        <label>访问口令</label>
        <input v-model="token" type="password" placeholder="输入 ACCESS_TOKEN" autofocus />
        <div class="row" style="margin-top: 16px">
          <button class="primary" style="flex: 1" :disabled="loading">进入酒馆</button>
        </div>
        <p v-if="error" style="color: var(--warn)">{{ error }}</p>
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
  max-width: 360px;
  text-align: center;
}
.login-card h1 {
  color: var(--primary);
  margin: 0 0 6px;
}
</style>
