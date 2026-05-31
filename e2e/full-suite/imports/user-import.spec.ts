import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('admin can submit a user import preflight', async ({ page }) => {
  const session = await loginAs('super_admin')
  const fileBytes = Buffer.from('[{"email":"imported-user@example.com","full_name":"Imported User","role":"donor"}]')
  const response = await page.request.post(`${API_URL}/admin/users/import/preflight`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    multipart: {
      file: {
        name: 'users.json',
        mimeType: 'application/json',
        buffer: fileBytes,
      },
    },
  })

  expect(response.status()).toBeLessThan(500)
})

test('user import error report returns content', async ({ page }) => {
  const session = await loginAs('super_admin')
  const response = await page.request.post(`${API_URL}/admin/users/import/error-report`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      format: 'csv',
      rows: [
        {
          row_number: 2,
          email: 'duplicate@example.com',
          full_name: 'Duplicate User',
          status: 'error',
          message: 'duplicate',
        },
      ],
    },
  })
  const body = (await response.json()) as Record<string, unknown>

  expect(response.ok(), await response.text()).toBeTruthy()
  expect(String(body.content ?? '')).toContain('duplicate')
})
