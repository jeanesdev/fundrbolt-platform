import { provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('duplicating an event returns a new draft event', async ({ adminApi }) => {
  const source = (await provisionEvent(adminApi)) as Record<string, unknown>
  const duplicate = (await adminApi.post<Record<string, unknown>>(`/events/${String(source.id)}/duplicate`))

  expect(duplicate.id).toBeTruthy()
  expect(String(duplicate.status ?? 'draft')).toBe('draft')
})

test('duplicated events receive a different slug', async ({ adminApi }) => {
  const source = (await provisionEvent(adminApi)) as Record<string, unknown>
  const duplicate = (await adminApi.post<Record<string, unknown>>(`/events/${String(source.id)}/duplicate`))

  expect(duplicate.slug).not.toBe(source.slug)
})
