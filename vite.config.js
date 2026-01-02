import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    keepNames: false,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'interview-prep': resolve(__dirname, 'interview-prep.html'),
        content: resolve(__dirname, 'src/content.js'),
        background: resolve(__dirname, 'src/background.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'main' ? 'assets/[name]-[hash].js' : '[name].js';
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
