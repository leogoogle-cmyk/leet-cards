import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // ------------------------------------------------------------------
    // vite-plugin-pwa：以 Workbox 產生 Service Worker。
    // 建置時把所有 JS / CSS / HTML / 圖示列入 precache，
    // 首次載入後即可完全離線（飛航模式仍能開地圖、答題）。
    // 題庫打包在 JS 內，不需要另外快取 API 回應。
    // ------------------------------------------------------------------
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'LeetCards — LeetCode 觀念閃卡',
        short_name: 'LeetCards',
        description: 'Duolingo 風格的 LeetCode 演算法觀念間隔重複閃卡',
        lang: 'zh-Hant',
        theme_color: '#58cc02',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webmanifest}'],
        // 單頁應用：離線時所有導覽請求都回 index.html
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
});
