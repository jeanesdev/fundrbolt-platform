const path = '/home/jjeanes/dev/fundrbolt-platform/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright'
const { chromium, request } = require(path)

const APP_URL = process.env.SMOKE_APP_URL || 'http://localhost:5174'
const API_URL = process.env.SMOKE_API_URL || 'http://localhost:8000/api/v1'
const SMOKE_EMAIL = process.env.SMOKE_EMAIL || 'super_admin@test.com'
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD || 'SuperAdmin123!'
const SMOKE_REFRESH_TOKEN = process.env.SMOKE_REFRESH_TOKEN || ''
const SMOKE_ACCESS_TOKEN = process.env.SMOKE_ACCESS_TOKEN || ''
const SMOKE_USER_JSON = process.env.SMOKE_USER_JSON || ''
const SMOKE_EVENT_SLUG = process.env.SMOKE_EVENT_SLUG || ''

async function run() {
    const errors = {
        consoleErrors: [],
        pageErrors: [],
        requestFailures: [],
        serverErrors: [],
        clientErrors: [],
    }

    const apiContext = await request.newContext()

    let eventSlug = SMOKE_EVENT_SLUG
    let accessToken = SMOKE_ACCESS_TOKEN
    let smokeUser = null

    if (SMOKE_USER_JSON) {
        smokeUser = JSON.parse(SMOKE_USER_JSON)
    }

    if (!(SMOKE_REFRESH_TOKEN && SMOKE_EVENT_SLUG) && (!eventSlug || !accessToken || !smokeUser)) {
        const loginRes = await apiContext.post(`${API_URL}/auth/login`, {
            data: { email: SMOKE_EMAIL, password: SMOKE_PASSWORD },
        })

        if (!loginRes.ok()) {
            throw new Error(`API login failed: ${loginRes.status()} ${await loginRes.text()}`)
        }

        const loginJson = await loginRes.json()
        accessToken = loginJson.access_token
        smokeUser = loginJson.user

        const eventsRes = await apiContext.get(`${API_URL}/events?per_page=20`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!eventsRes.ok()) {
            throw new Error(`Events fetch failed: ${eventsRes.status()} ${await eventsRes.text()}`)
        }

        const eventsJson = await eventsRes.json()
        const activeEvent = (eventsJson.items || []).find((event) => event.status === 'active')
        if (!activeEvent || !activeEvent.slug) {
            throw new Error('No active event found for smoke test')
        }
        eventSlug = activeEvent.slug
    }

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            errors.consoleErrors.push(msg.text())
        }
    })

    page.on('pageerror', (error) => {
        errors.pageErrors.push(error.message)
    })

    page.on('requestfailed', (req) => {
        const url = req.url()
        const errorText = req.failure()?.errorText || 'unknown'
        const isExpectedViteAbort =
            errorText.includes('ERR_ABORTED') &&
            (
                url.includes('localhost:5174/src/routes/') ||
                url.includes('localhost:5174/node_modules/.vite/deps/')
            )

        if (isExpectedViteAbort) {
            return
        }

        errors.requestFailures.push(`${req.method()} ${url} :: ${errorText}`)
    })

    page.on('response', (response) => {
        if (response.status() >= 400 && response.status() < 500) {
            errors.clientErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
        }
        if (response.status() >= 500) {
            errors.serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
        }
    })

    if (SMOKE_REFRESH_TOKEN && SMOKE_EVENT_SLUG) {
        await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded' })
        await page.evaluate(({ refreshToken }) => {
            localStorage.setItem('fundrbolt_refresh_token', refreshToken)
            localStorage.setItem('fundrbolt_token_expiry', String(Date.now() + 6 * 24 * 60 * 60 * 1000))
        }, { refreshToken: SMOKE_REFRESH_TOKEN })
    } else if (SMOKE_ACCESS_TOKEN && SMOKE_USER_JSON && SMOKE_EVENT_SLUG) {
        await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded' })
        await page.evaluate(
            async ({ token, user }) => {
                const mod = await import('/src/stores/auth-store.ts')
                mod.useAuthStore.setState({
                    accessToken: token,
                    refreshToken: '',
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                })
            },
            { token: accessToken, user: smokeUser }
        )
    } else {
        await page.goto(`${APP_URL}/sign-in`, { waitUntil: 'domcontentloaded' })
        await page.locator('input[name="email"]').first().fill(SMOKE_EMAIL)
        await page.locator('input[name="password"]').first().fill(SMOKE_PASSWORD)
        await page.getByRole('button', { name: 'Sign in' }).click()

        await page.waitForTimeout(1500)
        const currentPathAfterLogin = new URL(page.url()).pathname
        if (currentPathAfterLogin === '/sign-in') {
            const bodyText = await page.locator('body').innerText()
            throw new Error(`Login did not navigate away from /sign-in. Visible text:\n${bodyText.slice(0, 1000)}`)
        }
    }

    await page.goto(`${APP_URL}/events/${eventSlug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4000)

    const auctionLabelCount = await page.getByText('Auction Items', { exact: true }).count()
    if (auctionLabelCount === 0) {
        const bodyText = await page.locator('body').innerText()
        throw new Error(
            `Auction Items heading not found at URL ${page.url()}\\nVisible text:\\n${bodyText.slice(0, 1200)}`
        )
    }

    const auctionErrorVisible = await page.getByText('Failed to load auction items').count()
    const seatingErrorVisible = await page
        .getByText('Unable to load seating information. Please try again later.')
        .count()

    if (auctionErrorVisible > 0) {
        throw new Error('Smoke check failed: auction error banner is visible')
    }

    if (seatingErrorVisible > 0) {
        throw new Error('Smoke check failed: seating error banner is visible')
    }

    if (errors.pageErrors.length) {
        throw new Error(`Unhandled page errors:\n${errors.pageErrors.join('\n')}`)
    }

    if (errors.requestFailures.length) {
        throw new Error(`Network request failures:\n${errors.requestFailures.join('\n')}`)
    }

    if (errors.serverErrors.length) {
        throw new Error(`HTTP 5xx responses:\n${errors.serverErrors.join('\n')}`)
    }

    if (errors.clientErrors.length) {
        throw new Error(`HTTP 4xx responses:\n${errors.clientErrors.join('\n')}`)
    }

    if (errors.consoleErrors.length) {
        throw new Error(`Console errors:\n${errors.consoleErrors.join('\n')}`)
    }

    console.log('SMOKE_CHECK_PASS')
    console.log(`Event slug: ${eventSlug}`)
    console.log('Verified: sign-in, event page, auction section, no visible auction/seating error banners, no console/page/request/5xx errors')

    await context.close()
    await browser.close()
    await apiContext.dispose()
}

run().catch((error) => {
    console.error('SMOKE_CHECK_FAIL')
    console.error(error.message)
    process.exit(1)
})
