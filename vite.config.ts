import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = fileURLToPath(new URL('.', import.meta.url));

// Extension pages are plain multi-entry HTML. manifest.json, icons and
// theme-init.js are copied verbatim from /public.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(root, 'sidepanel.html'),
        popup: resolve(root, 'popup.html'),
        options: resolve(root, 'options.html'),
        'service-worker': resolve(root, 'src/background/service-worker.ts'),
      },
      output: {
        // The manifest points at the worker by name, so it can't carry a content hash.
        entryFileNames: (chunk) => (chunk.name === 'service-worker' ? 'service-worker.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
