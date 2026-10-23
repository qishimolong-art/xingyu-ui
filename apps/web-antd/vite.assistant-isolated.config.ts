import { defineConfig } from '@vben/vite-config';

// Explicit isolated entrypoint; the ordinary ERP development proxy stays unchanged.
export default defineConfig(async () => ({
  application: {},
  vite: {
    server: {
      host: '127.0.0.1',
      port: 5667,
      strictPort: true,
      proxy: {
        '/admin-api': {
          changeOrigin: true,
          target: 'http://127.0.0.1:48081',
          ws: true,
        },
      },
    },
  },
}));
