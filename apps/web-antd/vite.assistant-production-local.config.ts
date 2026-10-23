import { defineConfig } from '@vben/vite-config';

// Dedicated local acceptance server; keeps the ordinary development proxy intact.
export default defineConfig(async () => ({
  application: {},
  vite: {
    server: {
      host: '127.0.0.1',
      port: 5666,
      strictPort: true,
      // Keep in-flight acceptance queries stable while other workspace files change.
      hmr: false,
      proxy: {
        '/admin-api': {
          changeOrigin: true,
          target: 'http://127.0.0.1:48080',
          ws: true,
        },
      },
    },
  },
}));
