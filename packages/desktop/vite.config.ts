import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: path.join(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: 'dist-electron/main',
            sourcemap: true,
            minify: false,
            rollupOptions: {
              external: [
                'better-sqlite3',
                'node-pty',
                'execa',
                'electron'
              ]
            }
          }
        }
      },
      {
        entry: path.join(__dirname, 'src/preload/index.ts'),
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            sourcemap: true,
            minify: false,
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src')
    }
  },
  server: {
    port: 5173
  }
});
