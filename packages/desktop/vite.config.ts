import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { agenticEnginePlugin } from './vite-engine-plugin.js';

const host = process.env.TAURI_DEV_HOST;
/** Only set by `pnpm dev:web` — never during `tauri dev`. */
const isWebDev = process.env.AGENTIC_WEB_DEV === '1';

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'serve' && isWebDev ? [agenticEnginePlugin()] : [])],
  clearScreen: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    },
    proxy:
      command === 'serve' && isWebDev
        ? {
            '/agentic': {
              target: 'http://127.0.0.1:3847',
              changeOrigin: true,
              rewrite: (requestPath) => requestPath.replace(/^\/agentic/, '')
            }
          }
        : undefined
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG
  }
}));
