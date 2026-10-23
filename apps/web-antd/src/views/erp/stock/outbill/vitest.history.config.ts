import { fileURLToPath } from 'node:url';
import Vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: { '#': fileURLToPath(new URL('../../../../', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    maxWorkers: 1,
    include: [
      'apps/web-antd/src/views/erp/stock/outbill/*history*.test.ts',
      'apps/web-antd/src/views/erp/stock/outbill/outbill-page-contract.test.ts',
      'apps/web-antd/src/views/erp/stock/outbill/modules/outbill-item-sort.test.ts',
      'apps/web-antd/src/views/erp/stock/warehouse/warehouse-data.test.ts',
    ],
  },
});
