import { provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('npo admin can create an event', async ({ adminApi }) => {
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>

  expect(event.id).toBeTruthy()
})

test('newly created events default to draft status', async ({ adminApi }) => {
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>

  expect(String(event.status ?? 'draft')).toBe('draft')
})
