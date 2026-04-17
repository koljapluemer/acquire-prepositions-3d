import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@public': fileURLToPath(new URL('./public', import.meta.url)),
    },
  },
});
