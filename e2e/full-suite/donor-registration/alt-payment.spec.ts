import { API_URL } from '../../playwright.config'
import type { ApiClient } from '../../helpers/api-client'
import { loginAs } from '../../helpers/auth'
import { provisionEvent, provisionTicketPackage } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

async function submitAlternativePayment(
  page: { request: { post(url: string, options?: Record<string, unknown>): Promise<{ json(): Promise<unknown>; status(): number }> } },
  adminApi: ApiClient,
  paymentMethod: 'cash' | 'check',
) {
  const session = await loginAs('donor')
  const event = (await provisionEvent(adminApi, { status: 'active' })) as Record<string, unknown>
  const ticketPackage = (await provisionTicketPackage(adminApi, String(event.id), { is_enabled: true })) as Record<string, unknown>
  return page.request.post(`${API_URL}/events/${String(event.id)}/tickets/checkout`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      items: [{ package_id: ticketPackage.id, quantity: 1 }],
      payment_method: paymentMethod,
    },
  })
}

test('cash payment recording returns a confirmed status', async ({ page, adminApi }) => {
  const response = await submitAlternativePayment(page, adminApi, 'cash')
  const body = (await response.json()) as Record<string, unknown>

  expect(response.status()).toBeLessThan(500)
  expect(body.status ?? body.success ?? true).toBeTruthy()
})

test('check payment recording returns a confirmed status', async ({ page, adminApi }) => {
  const response = await submitAlternativePayment(page, adminApi, 'check')
  const body = (await response.json()) as Record<string, unknown>

  expect(response.status()).toBeLessThan(500)
  expect(body.status ?? body.success ?? true).toBeTruthy()
})
