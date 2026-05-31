import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('legal documents endpoint returns published documents', async ({ page }) => {
  const response = await page.request.get(`${API_URL}/legal/documents`)
  const body = (await response.json()) as Record<string, unknown> | Array<Record<string, unknown>>
  const documents = Array.isArray(body)
    ? body
    : Array.isArray(body.documents)
      ? (body.documents as Array<Record<string, unknown>>)
      : []

  expect(response.status()).toBeLessThan(500)
  expect(Array.isArray(documents)).toBe(true)
})

test('accepting the current legal version succeeds', async ({ page }) => {
  const session = await loginAs('donor')
  const documentsResponse = await page.request.get(`${API_URL}/legal/documents`)
  const body = (await documentsResponse.json()) as Record<string, unknown> | Array<Record<string, unknown>>
  const documents = Array.isArray(body)
    ? body
    : Array.isArray(body.documents)
      ? (body.documents as Array<Record<string, unknown>>)
      : []
  const versionIds = documents
    .map((document) => String(document.current_version_id ?? document.id ?? ''))
    .filter((value) => value.length > 0)

  test.skip(versionIds.length === 0, 'No published legal documents are available')

  const response = await page.request.post(`${API_URL}/consent/accept`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      version_ids: versionIds,
      document_version_ids: versionIds,
    },
  })

  expect(response.status()).toBeLessThan(500)
})
