import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/checkin',
  fullyParallel: false,
  retries: 1,
  timeout: 60_000,
  use: {
    baseURL: process.env.CHECKIN_APP_URL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  reporter: [['list']],
})
