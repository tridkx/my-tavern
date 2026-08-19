import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/chat', component: () => import('@/views/ChatView.vue') },
    { path: '/chat/:id', component: () => import('@/views/ChatView.vue') },
    { path: '/characters', component: () => import('@/views/CharactersView.vue') },
    { path: '/worldbooks', component: () => import('@/views/WorldbooksView.vue') },
    { path: '/connections', component: () => import('@/views/ConnectionsView.vue') },
    { path: '/media', component: () => import('@/views/MediaView.vue') },
    { path: '/tools', component: () => import('@/views/ToolsView.vue') },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;
  const res = await fetch('/api/auth/status', { credentials: 'include' }).catch(() => null);
  const data = res && res.ok ? await res.json() : { secured: false, authenticated: true };
  if (data.secured && !data.authenticated) return '/login';
  return true;
});
