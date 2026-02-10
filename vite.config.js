import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron({
      entry: 'main.js',
      vite: {
        build: {
          rollupOptions: {
            external: ['electron', 'fs-extra', 'path', 'os', 'chokidar', 'archiver', 'xlsx', 'officegen', 'docx', 'mammoth', 'ws', 'puppeteer-core'],
            output: {
              format: 'cjs'
            }
          }
        }
      }
    }),
    electronRenderer({
      nodeIntegration: false,
    }),
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron', 'fs-extra', 'path', 'os', 'chokidar', 'archiver', 'xlsx', 'officegen', 'mammoth', 'ws', 'puppeteer-core'],
    },
  },
  optimizeDeps: {
    exclude: ['fs-extra', 'path', 'os', 'chokidar', 'archiver', 'xlsx', 'officegen', 'mammoth', 'ws', 'puppeteer-core']
  },
  server: {
    port: 5173,
  },
});
