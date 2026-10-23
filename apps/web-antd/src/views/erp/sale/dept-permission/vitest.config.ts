import { fileURLToPath } from 'node:url';

// 测试从 monorepo 根目录运行，插件由根 package.json 提供。
// eslint-disable-next-line n/no-extraneous-import
import Vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: { '#': fileURLToPath(new URL('../../../../', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['apps/web-antd/src/views/erp/sale/dept-permission/*.test.ts'],
  },
});
