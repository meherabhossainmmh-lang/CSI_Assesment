/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The frontend always calls the backend with relative /api URLs; in dev the
// Vite server proxies them to the Express backend on :3000. In the hosted
// preview the same relative URLs flow through this dev server, so no
// hardcoded localhost ever reaches the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    cors: true,
    // The hosted preview reaches Vite through a proxied *.e2b.app hostname.
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  preview: { host: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
