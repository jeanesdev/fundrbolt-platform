import { test as base } from '@playwright/test'

import { MAILPIT_API_URL } from '../playwright.config'
import { loginAs } from '../helpers/auth'
import { MailpitClient } from '../helpers/email'

export type SeedRefs = {
  nonprofitSlug: string
  futureEventSlug: string
  liveEventSlug: string
  pastEventSlug: string
  nonprofitId: string
  futureEventId: string
  liveEventId: string
  pastEventId: string
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
  seedRefs: async ({ adminApi }, use) => {
    const eventsRes = await adminApi.get<{ items: Array<{ id: string; slug: string; npo_id: string }> }>('/events')
    const items = eventsRes.items ?? []
    const find = (slug: string) => items.find((e) => e.slug === slug)
    const live = find('seed-live-event')
    const future = find('seed-future-event')
    const past = find('seed-past-event')

    const nonprofitId = live?.npo_id ?? future?.npo_id ?? past?.npo_id
    if (!nonprofitId) throw new Error('seedRefs: no seed events found — has the DB been seeded?')
    if (!live?.id) throw new Error('seedRefs: seed-live-event not found — has the DB been seeded?')
    if (!future?.id) throw new Error('seedRefs: seed-future-event not found — has the DB been seeded?')
    if (!past?.id) throw new Error('seedRefs: seed-past-event not found — has the DB been seeded?')

    await use({
      nonprofitSlug: 'seed-nonprofit',
      futureEventSlug: 'seed-future-event',
      liveEventSlug: 'seed-live-event',
      pastEventSlug: 'seed-past-event',
      nonprofitId,
      liveEventId: live.id,
      futureEventId: future.id,
      pastEventId: past.id,
    })
  },
  mailpit: async ({}, use) => {
    const client = new MailpitClient(MAILPIT_API_URL)
    await client.deleteAll().catch(() => undefined)
    await use(client)
  },
})

export { expect } from '@playwright/test'
