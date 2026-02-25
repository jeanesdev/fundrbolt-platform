import { expect, test } from '@playwright/test'

const API_URL = process.env.CHECKIN_API_URL ?? 'http://127.0.0.1:8000/api/v1'
const SMOKE_EMAIL = process.env.SMOKE_EMAIL ?? 'super_admin@test.com'
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD ?? 'SuperAdmin123!'

type LoginResponse = {
  access_token: string
  user: unknown
}

type EventListResponse = {
  items?: Array<{
    id?: string
    slug?: string
    status?: string
  }>
}

test.describe('event dashboard smoke', () => {
  test('loads dashboard page and renders dashboard content', async ({ request, page, baseURL }) => {
    expect(baseURL, 'Expected Playwright baseURL to be configured').toBeTruthy()

    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: { email: SMOKE_EMAIL, password: SMOKE_PASSWORD },
    })

    expect(loginResponse.ok(), `Login failed: ${loginResponse.status()} ${await loginResponse.text()}`).toBeTruthy()

    const loginPayload = (await loginResponse.json()) as LoginResponse
    const accessToken = loginPayload.access_token

    const eventsResponse = await request.get(`${API_URL}/events?per_page=20`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    expect(eventsResponse.ok(), `Events fetch failed: ${eventsResponse.status()} ${await eventsResponse.text()}`).toBeTruthy()

    const eventsPayload = (await eventsResponse.json()) as EventListResponse
    const events = eventsPayload.items ?? []
    expect(events.length, 'Expected at least one event for smoke test').toBeGreaterThan(0)

    const activeEvent = events.find((event) => event.status === 'active') ?? events[0]
    const eventPathValue = activeEvent?.slug ?? activeEvent?.id
    expect(eventPathValue, 'Expected event slug or id in events response').toBeTruthy()

    const pageErrors: string[] = []
    const serverErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })
    page.on('response', (res) => {
      if (res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`)
      }
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem(
          'fundrbolt-auth-storage',
          JSON.stringify({
            state: {
              user,
              accessToken: token,
              refreshToken: '',
              isAuthenticated: true,
            },
            version: 0,
          })
        )
      },
      { token: accessToken, user: loginPayload.user }
    )

    const dashboardPath = `/events/${eventPathValue}/dashboard`
    const response = await page.goto(dashboardPath, { waitUntil: 'domcontentloaded' })
    expect(response, 'Expected document response when opening dashboard page').toBeTruthy()
    expect(response?.ok(), `Dashboard page returned ${response?.status()}`).toBeTruthy()

    await expect(page).toHaveURL(new RegExp('/events/.+/dashboard$'))

    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()
    await expect(page.getByText('Projection Controls', { exact: true })).toBeVisible()
    await expect(page.getByText('Goal', { exact: true })).toBeVisible()
    await expect(page.getByText(/Hello\s+"\/_authenticated\/events\/\$eventId\/dashboard"!/)).toHaveCount(0)
    await expect(page.getByText('Unexpected Application Error')).toHaveCount(0)
    await expect(page.getByText('Internal Server Error')).toHaveCount(0)
    await expect(page.locator('body')).not.toBeEmpty()

    expect(pageErrors, `Unhandled page errors:\n${pageErrors.join('\n')}`).toEqual([])
    expect(serverErrors, `HTTP 5xx responses:\n${serverErrors.join('\n')}`).toEqual([])
  })
})
