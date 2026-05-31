import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

export const ADMIN_APP_URL = process.env.ADMIN_APP_URL ?? 'http://127.0.0.1:5173'
export const DONOR_APP_URL = process.env.DONOR_APP_URL ?? 'http://127.0.0.1:5174'
export const API_URL = process.env.API_URL ?? 'http://127.0.0.1:8000/api/v1'
export const MAILPIT_API_URL = process.env.MAILPIT_API_URL ?? 'http://127.0.0.1:8025'

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  retries: 1,
  workers: 4,
  reporter: [['html'], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL: DONOR_APP_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
