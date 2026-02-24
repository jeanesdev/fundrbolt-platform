import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/checkin',
  fullyParallel: false,
  retries: 1,
  timeout: 30_000,
  use: {
    baseURL: process.env.CHECKIN_API_URL ?? 'http://127.0.0.1:8000',
    trace: 'on-first-retry',
  },
  reporter: [['list']],
})
