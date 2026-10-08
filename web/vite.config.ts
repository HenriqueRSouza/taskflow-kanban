/// <reference types="vitest/config" />

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      include: ['src/**'],
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/main.tsx', 'src/lib/devSeed.ts', 'src/vite-env.d.ts'],
      reporter: ['text', 'html'],
    },
  },
});
