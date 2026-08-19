import { buildApp } from './app.js';
import { HOST, PORT, ensureDataDirs } from './config.js';

ensureDataDirs();

const app = await buildApp();

try {
  await app.listen({ host: HOST, port: PORT });
  app.log.info(`MyTavern listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
