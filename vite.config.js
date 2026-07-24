import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Ebookee — бытовые услуги рядом',
        short_name: 'Ebookee',
        description: 'Клининг, красота, массаж, няни, мастер на час — найти исполнителя и записаться',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        // Жёлтый — цвет веб-версии: именно её видит установленное приложение.
        // Синий #2481cc остаётся только внутри мини-аппа в Telegram.
        theme_color: '#FDB813',
        background_color: '#FBFAF7',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Кэшируем статику агрессивно, API-запросы к Supabase не трогаем
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
})