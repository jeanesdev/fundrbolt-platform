import { randomUUID } from 'node:crypto'

import type { ApiClient } from './api-client'

export async function provisionEvent(apiClient: ApiClient, payload: Record<string, unknown> = {}) {
  const suffix = randomUUID().slice(0, 8)
  // Resolve npo_id from an existing event if not provided
  let npoId = payload.npo_id as string | undefined
  if (!npoId) {
    const eventsRes = await apiClient.get<{ items: Array<{ npo_id: string }> }>('/events')
    npoId = eventsRes.items?.[0]?.npo_id
    if (!npoId) throw new Error('provisionEvent: could not resolve npo_id — no existing events found and none supplied in payload')
  }
  return apiClient.post('/events', {
    name: `Automation Event ${suffix}`,
    slug: `automation-event-${suffix}`,
    timezone: 'America/New_York',
    event_datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    npo_id: npoId,
    ...payload,
  })
}

export async function provisionUser(apiClient: ApiClient, payload: Record<string, unknown> = {}) {
  const suffix = randomUUID().slice(0, 8)
  return apiClient.post('/users', {
    email: `automation+${suffix}@fundrbolt.com`,
    password: process.env.SEED_TEST_PASSWORD ?? 'TestPassword123!',
    first_name: 'Automation',
    last_name: `User ${suffix}`,
    role: 'donor',
    ...payload,
  })
}

export async function provisionTicketPackage(apiClient: ApiClient, eventId: string, payload: Record<string, unknown> = {}) {
  const suffix = randomUUID().slice(0, 8)
  return apiClient.post(`/admin/events/${eventId}/packages`, {
    event_id: eventId,
    name: `Automation Package ${suffix}`,
    price: 125,
    seats_per_package: 1,
    quantity_limit: 25,
    ...payload,
  })
}

export async function provisionAuctionItem(apiClient: ApiClient, eventId: string, payload: Record<string, unknown> = {}) {
  const suffix = randomUUID().slice(0, 8)
  return apiClient.post(`/events/${eventId}/auction-items`, {
    title: `Automation Item ${suffix}`,
    description: 'Provisioned by Playwright helper',
    auction_type: 'silent',
    starting_bid: 100,
    bid_increment: 10,
    quantity_available: 1,
    ...payload,
  })
}

export async function provisionRegistration(apiClient: ApiClient, payload: Record<string, unknown>) {
  return apiClient.post('/registrations', payload)
}
