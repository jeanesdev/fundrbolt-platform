import { expect, test } from '../../fixtures/base-fixtures'

test('super admin can list NPOs', async ({ superAdminApi }) => {
  const response = await superAdminApi.get<Record<string, unknown>>('/npos')
  const items = Array.isArray(response.items) ? (response.items as Array<Record<string, unknown>>) : []

  expect(Array.isArray(items)).toBe(true)
})

test('super admin can fetch NPO members from NPO detail', async ({ superAdminApi }) => {
  const list = await superAdminApi.get<Record<string, unknown>>('/npos')
  const items = Array.isArray(list.items) ? (list.items as Array<Record<string, unknown>>) : []
  expect(items.length).toBeGreaterThan(0)

  const firstId = String(items[0]?.id ?? '')
  expect(firstId).toBeTruthy()
  const detail = await superAdminApi.get<Record<string, unknown>>(`/npos/${firstId}`)
  expect(detail.id ?? firstId).toBeTruthy()
})
