import { randomUUID } from 'node:crypto'

import { DONOR_APP_URL, API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { provisionEvent, provisionTicketPackage } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('duplicate checkout submissions are idempotent', async ({ page, adminApi }) => {
  const session = await loginAs('donor')
  const event = (await provisionEvent(adminApi, { status: 'active' })) as Record<string, unknown>
  const idempotencyKey = randomUUID()
  const payload = {
    event_id: String(event.id),
    line_items: [{ type: 'ticket', label: 'General Admission', amount: '125.00' }],
    save_profile: false,
    return_url: `${DONOR_APP_URL}/checkout/complete`,
    idempotency_key: idempotencyKey,
  }

  const first = await page.request.post(`${API_URL}/payments/session`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: payload,
  })
  const second = await page.request.post(`${API_URL}/payments/session`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: payload,
  })
  const firstBody = (await first.json()) as Record<string, unknown>
  const secondBody = (await second.json()) as Record<string, unknown>

  expect([200, 201]).toContain(first.status())
  expect(firstBody.transaction_id ?? firstBody.id).toBe(secondBody.transaction_id ?? secondBody.id)
})

test('zero-quantity ticket checkout is rejected', async ({ page, adminApi }) => {
  const session = await loginAs('donor')
  const event = (await provisionEvent(adminApi, { status: 'active' })) as Record<string, unknown>
  const ticketPackage = (await provisionTicketPackage(adminApi, String(event.id), { is_enabled: true })) as Record<string, unknown>
  const response = await page.request.post(`${API_URL}/events/${String(event.id)}/tickets/checkout`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      items: [{ package_id: ticketPackage.id, quantity: 0 }],
    },
  })

  expect([400, 409, 422]).toContain(response.status())
})
