import { randomUUID } from 'node:crypto'

import { DONOR_APP_URL, API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { provisionEvent, provisionTicketPackage } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('donor can initiate a checkout session', async ({ page, adminApi }) => {
  const session = await loginAs('donor')
  const event = (await provisionEvent(adminApi, { status: 'active' })) as Record<string, unknown>
  const response = await page.request.post(`${API_URL}/payments/session`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      event_id: String(event.id),
      line_items: [{ type: 'ticket', label: 'General Admission', amount: '125.00' }],
      save_profile: false,
      return_url: `${DONOR_APP_URL}/checkout/complete`,
      idempotency_key: randomUUID(),
    },
  })
  const body = (await response.json()) as Record<string, unknown>

  expect([200, 201]).toContain(response.status())
  expect(body.transaction_id ?? body.id).toBeTruthy()
})

test('ticket checkout returns an order confirmation payload', async ({ page, adminApi }) => {
  const session = await loginAs('donor')
  const event = (await provisionEvent(adminApi, { status: 'active' })) as Record<string, unknown>
  const ticketPackage = (await provisionTicketPackage(adminApi, String(event.id), { is_enabled: true })) as Record<string, unknown>
  const response = await page.request.post(`${API_URL}/events/${String(event.id)}/tickets/checkout`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      items: [{ package_id: ticketPackage.id, quantity: 1 }],
    },
  })
  const body = (await response.json()) as Record<string, unknown>

  expect([200, 201]).toContain(response.status())
  expect(body.success ?? body.purchases).toBeTruthy()
})
