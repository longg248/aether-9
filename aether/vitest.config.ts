import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./scr', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['scr/**/*.test.ts'],
  },
});
