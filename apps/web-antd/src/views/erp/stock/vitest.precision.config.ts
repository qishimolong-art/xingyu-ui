/* eslint-disable n/no-extraneous-import -- Matches repository Vitest/Vue tooling. */
import { fileURLToPath } from 'node:url';

import Vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: { '#': fileURLToPath(new URL('../../../', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    maxWorkers: 1,
    include: ['apps/web-antd/src/views/erp/stock/**/*.test.ts'],
  },
});
