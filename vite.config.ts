import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const CESIUM_BUILD = path.resolve(__dirname, 'node_modules/cesium/Build/Cesium');

const MIME: Record<string, string> = {
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.xml':  'application/xml',
  '.css':  'text/css',
  '.glb':  'model/gltf-binary',
  '.ktx2': 'image/ktx2',
};

// Dev-mode plugin: serve Cesium's pre-built files under /cesium/*
// vite-plugin-static-copy only runs at build time; this fills the gap in dev.
const serveCesiumDev = {
  name: 'serve-cesium-dev',
  configureServer(server: { middlewares: { use: (path: string, handler: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (d: Buffer) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use('/cesium', (req, res, next) => {
      const url = (req.url || '/').split('?')[0];
      const filePath = path.join(CESIUM_BUILD, url);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
          res.end(fs.readFileSync(filePath));
          return;
        }
      } catch { /* not found — fall through */ }
      next();
    });
  },
};

export default defineConfig({
  plugins: [
    react(),
    serveCesiumDev,
    viteStaticCopy({
      targets: [
        { src: 'node_modules/cesium/Build/Cesium/Workers',   dest: 'cesium' },
        { src: 'node_modules/cesium/Build/Cesium/ThirdParty', dest: 'cesium' },
        { src: 'node_modules/cesium/Build/Cesium/Assets',    dest: 'cesium' },
        { src: 'node_modules/cesium/Build/Cesium/Widgets',   dest: 'cesium' },
      ],
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['cesium'],
    include: [
      'satellite.js',
      'mersenne-twister',
      'urijs',
      'nosleep.js',
      'bitmap-sdf',
      'grapheme-splitter',
      'lerc',
      'autolinker',
      'protobufjs',
      '@protobufjs/aspromise',
      '@protobufjs/base64',
      '@protobufjs/codegen',
      '@protobufjs/eventemitter',
      '@protobufjs/fetch',
      '@protobufjs/inquire',
      '@protobufjs/float',
      '@protobufjs/path',
      '@protobufjs/pool',
      '@protobufjs/utf8',
      'long',
      'commander',
    ],
  },
  build: {
    chunkSizeWarningLimit: 10000,
    rollupOptions: {
      output: {
        manualChunks: { cesium: ['cesium'] },
      },
    },
  },
  server: {
    port: 5173,
  },
});
