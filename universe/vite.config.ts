import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** Separate Vite app. Pulls select modules from the parent Boreal tree via `@boreal/*`. */
export default defineConfig({
  root,
  publicDir: 'public',
  resolve: {
    alias: {
      '@boreal': path.resolve(root, '../src'),
      three: path.resolve(root, '../node_modules/three'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    fs: { allow: [path.resolve(root, '..')] },
  },
  preview: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
  optimizeDeps: {
    include: ['three'],
  },
});
