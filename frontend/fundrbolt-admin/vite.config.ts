import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: false, // Disabled - was overwriting route files with stubs
      generatedRouteTree: './src/routeTree.gen.ts',
      routesDirectory: './src/routes',
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico',
        'images/*.png',
        'images/*.svg',
        'offline.html',
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/offline\.html/],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: /\/api\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60, // 24 hours
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 30,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Fundrbolt Admin',
        short_name: 'Fundrbolt Admin',
        description: 'Manage events, auctions, and nonprofit fundraising',
        theme_color: '#0f172a', // eslint-disable-line no-restricted-syntax
        background_color: '#ffffff', // eslint-disable-line no-restricted-syntax
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/images/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/images/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/images/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@fundrbolt/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0', // Listen on all interfaces
    allowedHosts: [
      '.ngrok-free.dev', // Allow all ngrok free domains
      '.ngrok.io', // Allow all ngrok domains
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
