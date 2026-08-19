import { buildApp } from './app.js';
import { ACCESS_TOKEN, HOST, PORT, ensureDataDirs } from './config.js';

ensureDataDirs();

if (!ACCESS_TOKEN && HOST !== '127.0.0.1' && HOST !== 'localhost') {
  console.warn(
    '[安全提醒] ACCESS_TOKEN 未设置且监听地址为 ' + HOST + '。公网/局域网部署时任何人都能访问所有数据与 API，请务必设置 ACCESS_TOKEN（并在 HTTPS 下设置 COOKIE_SECURE=1）。',
  );
}
if (ACCESS_TOKEN && ACCESS_TOKEN.length < 8 && HOST !== '127.0.0.1' && HOST !== 'localhost') {
  console.warn(
    '[安全提醒] ACCESS_TOKEN 只有 ' + ACCESS_TOKEN.length + ' 个字符，过短的口令可能被暴力破解。公网部署建议使用 12 位以上的随机口令。',
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
