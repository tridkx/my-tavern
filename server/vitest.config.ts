import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // database.ts 在模块加载时打开 SQLite 文件，并行 worker 会争锁；
    // 顺序执行 + 独立测试数据目录，避免污染真实 data/
    fileParallelism: false,
    env: {
      MY_TAVERN_DATA: './.test-data',
    },
  },
});
