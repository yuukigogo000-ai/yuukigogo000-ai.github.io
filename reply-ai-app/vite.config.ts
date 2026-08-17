import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// ビルド結果は ../reply-ai に出力する(GitHub Pages はリポジトリの静的ファイルをそのまま配信するため)
export default defineConfig({
  base: '/reply-ai/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        id: '/reply-ai/',
        name: 'Replier — 返信コーチ',
        short_name: 'Replier',
        description: 'LINE・マッチングアプリの会話から、あなたの文体のまま返信を提案する会話コーチ',
        lang: 'ja',
        start_url: '/reply-ai/',
        scope: '/reply-ai/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f4f6',
        theme_color: '#0b8f47',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/reply-ai/index.html',
        // API 通信(POST・別オリジン)は絶対にキャッシュしない
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  build: {
    outDir: '../reply-ai',
    emptyOutDir: true,
    target: 'es2020',
  },
});
