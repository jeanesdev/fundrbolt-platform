import { test as base } from '@playwright/test'

import { MAILPIT_API_URL } from '../playwright.config'
import { loginAs } from '../helpers/auth'
import { MailpitClient } from '../helpers/email'

export type SeedRefs = {
  nonprofitSlug: string
  futureEventSlug: string
  liveEventSlug: string
  pastEventSlug: string
}

export const test = base.extend<{
  adminApi: Awaited<ReturnType<typeof loginAs>>['apiClient']
  donorApi: Awaited<ReturnType<typeof loginAs>>['apiClient']
  superAdminApi: Awaited<ReturnType<typeof loginAs>>['apiClient']
  seedRefs: SeedRefs
  mailpit: MailpitClient
}>({
  adminApi: async ({}, use) => {
    const session = await loginAs('npo_admin')
    await use(session.apiClient)
  },
  donorApi: async ({}, use) => {
    const session = await loginAs('donor')
    await use(session.apiClient)
  },
  superAdminApi: async ({}, use) => {
    const session = await loginAs('super_admin')
    await use(session.apiClient)
  },
  seedRefs: async ({}, use) => {
    await use({
      nonprofitSlug: 'seed-nonprofit',
      futureEventSlug: 'seed-future-event',
      liveEventSlug: 'seed-live-event',
      pastEventSlug: 'seed-past-event',
    })
  },
  mailpit: async ({}, use) => {
    const client = new MailpitClient(MAILPIT_API_URL)
    await client.deleteAll().catch(() => undefined)
    await use(client)
  },
})

export { expect } from '@playwright/test'
