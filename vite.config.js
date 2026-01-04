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
    chunkSizeWarningLimit: 1000, // Increase limit since vosk-speech is intentionally large
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
        manualChunks: (id) => {
          // Separate React Flow into its own chunk (it's large)
          if (id.includes('reactflow') || id.includes('react-flow')) {
            return 'reactflow';
          }
          // Separate React and React DOM
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          // Vosk speech recognition (large, loaded on demand)
          if (id.includes('vosk-browser') || id.includes('onnxruntime')) {
            return 'vosk-speech';
          }
          // Transformers.js / Whisper (alternative, also large)
          if (id.includes('@xenova/transformers')) {
            return 'whisper-speech';
          }
          // Separate Ollama and MCP services into their own chunk (for better code splitting)
          if (id.includes('services/ollama.js') || id.includes('services/mcpClient.js')) {
            return 'ollama-services';
          }
          // Enhanced features services (can be lazy loaded)
          if (id.includes('services/enhanced') || id.includes('services/performanceLogger')) {
            return 'enhanced-features';
          }
          // Other large vendor libraries
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'lucide';
            }
            if (id.includes('html2canvas')) {
              return 'html2canvas';
            }
            if (id.includes('pako')) {
              return 'pako';
            }
            return 'vendor';
          }
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
