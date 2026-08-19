import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'prod-csp',
      // 生产构建时收紧 CSP：ws:/wss: 仅为 dev HMR 热更新所需，生产同源部署不需要
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace("connect-src 'self' ws: wss:", "connect-src 'self'");
      },
    } as Plugin,
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
  },
});
