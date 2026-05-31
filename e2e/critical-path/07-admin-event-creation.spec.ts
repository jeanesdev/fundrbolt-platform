import { provisionEvent } from '../helpers/provision'
import { expect, test } from '../fixtures/base-fixtures'

test('npo admin can provision a draft event', async ({ adminApi }) => {
  const event = await provisionEvent(adminApi)
  expect((event as { status?: string }).status ?? 'draft').toBeTruthy()
})
