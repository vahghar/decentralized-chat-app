import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: '3P Proximity Chat',
        short_name: '3P Chat',
        description: 'Decentralized P2P Proximity Chat',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          // Fallback placeholder icons (user should replace these in public folder)
          { src: 'https://via.placeholder.com/192', sizes: '192x192', type: 'image/png' },
          { src: 'https://via.placeholder.com/512', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts'
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    }
  }
});
