import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    keepNames: false,
  },
  server: {},
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'interview-prep': resolve(__dirname, 'interview-prep.html'),
        'content/contentScript': resolve(__dirname, 'src/content/contentScript.js'),
        'background/background': resolve(__dirname, 'src/background/background.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'main' || chunkInfo.name === 'interview-prep') {
            return 'assets/[name]-[hash].js';
          }
          if (chunkInfo.name === 'background/background') {
            return 'background.js';
          }
          if (chunkInfo.name === 'content/contentScript') {
            return 'content/contentScript.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      keepNames: false,
    },
  },
});
