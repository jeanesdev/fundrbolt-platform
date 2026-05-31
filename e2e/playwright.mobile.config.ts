import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['html'], ['json', { outputFile: 'results.json' }]],
  testMatch: [
    'critical-path/01-donor-signup.spec.ts',
    'critical-path/04-ticket-purchase.spec.ts',
    'full-suite/cross-cutting/pwa-features.spec.ts',
    'full-suite/cross-cutting/responsive-layout.spec.ts',
  ],
  use: {
    ...devices['iPhone 13'],
    viewport: { width: 375, height: 812 },
    isMobile: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
        viewport: { width: 375, height: 812 },
        isMobile: true,
      },
    },
  ],
})
