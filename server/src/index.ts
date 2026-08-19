import { buildApp } from './app.js';
import { ACCESS_TOKEN, HOST, PORT, ensureDataDirs } from './config.js';

ensureDataDirs();

if (!ACCESS_TOKEN && HOST !== '127.0.0.1' && HOST !== 'localhost') {
  console.warn(
    '[安全提醒] ACCESS_TOKEN 未设置且监听地址为 ' + HOST + '。公网/局域网部署时任何人都能访问所有数据与 API，请务必设置 ACCESS_TOKEN（并在 HTTPS 下设置 COOKIE_SECURE=1）。',
  );
}

const app = await buildApp();

try {
  await app.listen({ host: HOST, port: PORT });
  app.log.info(`MyTavern listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
