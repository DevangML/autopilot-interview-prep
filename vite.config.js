import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    keepNames: false,
  },
  server: {
    proxy: {
      '/api/notion': {
        target: 'https://api.notion.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          // Remove /api/notion prefix and ensure we have a leading /
          const newPath = path.replace(/^\/api\/notion/, '');
          return newPath.startsWith('/') ? newPath : '/' + newPath;
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Remove host header to avoid Cloudflare blocking
            proxyReq.removeHeader('host');
            
            // Forward specific headers we need
            const authHeader = req.headers.authorization;
            if (authHeader) {
              proxyReq.setHeader('Authorization', authHeader);
            }
            const notionVersion = req.headers['notion-version'] || req.headers['Notion-Version'] || '2022-06-28';
            proxyReq.setHeader('Notion-Version', notionVersion);
            const contentType = req.headers['content-type'] || req.headers['Content-Type'];
            if (contentType) {
              proxyReq.setHeader('Content-Type', contentType);
            }
            
            // Set user agent to avoid Cloudflare blocking
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Remove any other headers that might cause issues
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('origin');
          });
          
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Handle CORS headers
            const origin = req.headers.origin || '*';
            proxyRes.headers['access-control-allow-origin'] = origin;
            proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
            proxyRes.headers['access-control-allow-headers'] = 'Authorization, Notion-Version, Content-Type';
            proxyRes.headers['access-control-allow-credentials'] = 'true';
          });
          
          proxy.on('error', (err, req, res) => {
            console.error('Proxy error:', err);
            if (!res.headersSent) {
              res.writeHead(500, {
                'Content-Type': 'application/json',
                'access-control-allow-origin': req.headers.origin || '*'
              });
              res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
            }
          });
        },
      },
    },
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
          return chunkInfo.name === 'main' || chunkInfo.name === 'interview-prep' 
            ? 'assets/[name]-[hash].js' 
            : '[name].js';
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
