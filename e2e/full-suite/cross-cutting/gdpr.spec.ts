import { expect, test } from '../../fixtures/base-fixtures'

test('authenticated users can request a data export', async ({ donorApi }) => {
  const response = await donorApi.post<Record<string, unknown>>('/consent/data-export', {
    format: 'json',
  })

  expect(response).toBeTruthy()
})

test('authenticated users can request account deletion', async ({ donorApi }) => {
  const response = await donorApi.post<Record<string, unknown>>('/consent/data-deletion', {
    reason: 'Playwright GDPR coverage',
    confirmation: true,
  })

  expect(response).toBeTruthy()
})
