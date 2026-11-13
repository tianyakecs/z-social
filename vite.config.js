import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const API_TARGET = 'http://127.0.0.1:8787';

const proxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: false,
  },
};

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { proxy },
  preview: { proxy },
});
