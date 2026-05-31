import type { Page } from '@playwright/test'

export async function setEventTime(page: Page, offset: number): Promise<void> {
  await page.clock.setFixedTime(Date.now() + offset)
}

export async function resetClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(Date.now())
}
