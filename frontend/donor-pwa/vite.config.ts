import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { execSync } from 'child_process'
import { VitePWA } from 'vite-plugin-pwa'
import { version } from './package.json'

// Auto-generate version: major.minor from package.json, patch from git commit count
// This increments automatically on every build without manual package.json edits.
function buildVersion() {
  try {
    const commitCount = execSync('git rev-list HEAD --count', {
      encoding: 'utf8',
    }).trim()
    const [major, minor] = version.split('.')
    return `${major}.${minor}.${commitCount}`
  } catch {
    return version
  }
}

const appVersion = buildVersion()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      // Disabled because generated route stubs were overwriting preview routes during dev.
      autoCodeSplitting: false,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
        type: 'module',
      },
      includeAssets: [
        'favicon.ico',
        'images/*.png',
        'images/*.svg',
        'offline.html',
      ],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'FundrBolt Donor Portal',
        short_name: 'FundrBolt',
        description:
          'Browse events, place bids, and support your favorite causes',
        theme_color: '#111827',
        background_color: '#111827',
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
    // Upload source maps to Sentry only when SENTRY_AUTH_TOKEN is set (i.e. in CI)
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: 'fundrbolt-donor',
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@fundrbolt/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5174,
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
      '/ws': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
