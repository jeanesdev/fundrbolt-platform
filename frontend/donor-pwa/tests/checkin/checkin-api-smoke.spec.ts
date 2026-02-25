/// <reference types="node" />

import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

test.describe('check-in API smoke', () => {
  test.beforeEach(async ({ request }) => {
    let reachable = false
    let checkinRouteAvailable = false

    try {
      const response = await request.get('/health', { timeout: 5_000 })
      reachable = response.ok()

      if (reachable) {
        const openApiResponse = await request.get('/openapi.json', { timeout: 5_000 })
        if (openApiResponse.ok()) {
          const schema = (await openApiResponse.json()) as {
            paths?: Record<string, unknown>
          }
          checkinRouteAvailable = Boolean(schema.paths?.['/api/v1/checkin/lookup'])
        }
      }
    } catch {
      reachable = false
      checkinRouteAvailable = false
    }

    test.skip(!reachable, 'Backend API is not reachable at CHECKIN_API_URL')
    test.skip(!checkinRouteAvailable, 'Check-in API routes are not available in running backend')
  })

  test('smoke: lookup endpoint responds with valid payload shape', async ({ request }) => {
    const response = await request.post('/api/v1/checkin/lookup', {
      data: {
        confirmation_code: randomUUID(),
      },
    })

    expect(response.ok(), `Expected 2xx, got ${response.status()}`).toBeTruthy()

    const payload = (await response.json()) as {
      registrations?: unknown[]
      total?: number
    }

    expect(Array.isArray(payload.registrations)).toBeTruthy()
    expect(typeof payload.total).toBe('number')
  })

  test('returns 400 when lookup body is missing required fields', async ({ request }) => {
    const response = await request.post('/api/v1/checkin/lookup', {
      data: {},
    })

    expect(response.status()).toBe(400)

    const payload = (await response.json()) as {
      detail?: { code?: number; message?: string } | string
    }

    if (typeof payload.detail === 'string') {
      expect(payload.detail).toContain('Either confirmation_code or email must be provided')
      return
    }

    expect(payload.detail?.code).toBe(400)
    expect(payload.detail?.message).toContain('Either confirmation_code or email must be provided')
  })

  test('returns 404 for unknown registration check-in', async ({ request }) => {
    const response = await request.post(`/api/v1/checkin/registrations/${randomUUID()}`)

    expect(response.status()).toBe(404)

    const payload = (await response.json()) as {
      detail?: { code?: number; message?: string } | string
    }

    if (typeof payload.detail === 'string') {
      expect(payload.detail).toBe('Registration not found')
      return
    }

    expect(payload.detail?.code).toBe(404)
    expect(payload.detail?.message).toBe('Registration not found')
  })
})
