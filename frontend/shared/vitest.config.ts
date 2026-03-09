import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Provide a stub so Vite can resolve the virtual module before vi.mock replaces it
      'virtual:pwa-register/react': fileURLToPath(
        new URL(
          './src/pwa/__tests__/__mocks__/virtual-pwa-register-react.ts',
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/pwa/__tests__/setup.ts',
    css: false,
  },
})
