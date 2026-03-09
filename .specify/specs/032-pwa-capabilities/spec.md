# Feature Specification: PWA Capabilities

**Feature Branch**: `032-pwa-capabilities`
**Created**: 2026-03-05
**Status**: Draft
**Input**: User description: "pwa-capabilities"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Install to Home Screen (Priority: P1)

A donor attending a fundraising gala opens the FundrBolt Donor Portal in their mobile browser. A subtle banner appears at the bottom of the screen inviting them to "Add FundrBolt to your home screen for the best experience." They tap "Install," and the app icon appears on their home screen alongside their native apps. When they open the app from the home screen, it launches in a standalone window without the browser chrome, looking and feeling like a native application. The same experience is available for event coordinators using the Admin PWA on a tablet at the registration desk.

**Why this priority**: Installability is the defining characteristic of a PWA. Without it, both apps are simply websites with a manifest file. This is the single most impactful change that backs up the "PWA" claim when demonstrating the product.

**Independent Test**: Can be fully tested by opening either app on a mobile device, seeing the install prompt appear, tapping install, and verifying the app launches from the home screen in standalone mode without browser UI.

**Acceptance Scenarios**:

1. **Given** a donor visits the Donor Portal in a supported mobile browser for the first time, **When** the page loads, **Then** a non-intrusive install banner appears after a brief delay with the message "Add FundrBolt to your home screen for the best experience" and an "Install" button.
2. **Given** a user has already dismissed the install banner, **When** they return to the app later, **Then** the banner does not reappear for at least 7 days.
3. **Given** a user has already installed the app, **When** they visit the app in the browser, **Then** the install banner does not appear.
4. **Given** a user taps the "Install" button on the banner, **When** the browser's native install dialog appears and they confirm, **Then** the app is installed to their home screen with the correct icon, name, and theme colors.
5. **Given** a user opens the installed app from their home screen, **When** the app launches, **Then** it opens in standalone display mode without browser navigation chrome.
6. **Given** an admin visits the Admin Portal on a tablet, **When** the page loads, **Then** they also see the install prompt and can install the Admin app to their device.

---

### User Story 2 — Fast Load with Cached App Shell (Priority: P1)

A donor who previously visited the Donor Portal opens the app again. The app shell (navigation, layout, styles) loads instantly from cached assets, even on a slow or intermittent cellular connection at an event venue. API data then populates progressively as network requests complete. The admin app behaves the same way for event staff working from tablets.

**Why this priority**: Service worker precaching is the foundation that enables all other PWA features (offline support, install prompts on some browsers, fast repeat loads). Event venues often have congested WiFi, so cached app shells prevent the blank-screen experience.

**Independent Test**: Can be tested by loading either app once, throttling the network to "Slow 3G" or going offline, and reloading — the app shell should render immediately from cache.

**Acceptance Scenarios**:

1. **Given** a user has previously visited the app, **When** they reload the page, **Then** the app shell (HTML, CSS, JavaScript bundles) loads from the service worker cache without waiting for the network.
2. **Given** a user is on a slow connection, **When** they navigate between pages within the app, **Then** page transitions are instant because the app shell is already cached.
3. **Given** new code has been deployed, **When** a user opens the app, **Then** the service worker detects updated assets and updates the cache in the background, notifying the user that a new version is available with a "Refresh to update" prompt.
4. **Given** Google Fonts are used for typography, **When** the app has been loaded once, **Then** font files are served from cache on subsequent loads to prevent font-swap flicker.

---

### User Story 3 — Offline Fallback Page (Priority: P2)

A donor at a crowded gala venue loses their cellular and WiFi connection. Instead of seeing a browser error page ("No internet connection" dinosaur game), they see a branded FundrBolt page that says "You're offline. Please reconnect to continue bidding." with the FundrBolt logo and event-appropriate styling. The same experience applies to admin users. This reassures users that the app is still "there" and will resume when connectivity returns.

**Why this priority**: A branded offline page is a low-effort, high-impact improvement over the default browser error. It maintains trust and prevents the impression that the app is broken.

**Independent Test**: Can be tested by loading the app, going fully offline, and navigating to a new page — the offline fallback should render instead of a browser error.

**Acceptance Scenarios**:

1. **Given** a user has previously loaded the app, **When** they lose internet connectivity and attempt to navigate to any page, **Then** they see a branded offline fallback page instead of the browser's default error.
2. **Given** a user is viewing the offline fallback page, **When** their connectivity is restored, **Then** the page automatically detects the restored connection and offers to reload, or navigates to the originally requested page.
3. **Given** a user is on the offline fallback page, **When** they view the page, **Then** it displays the FundrBolt brand identity (logo, colors) and a clear, friendly message explaining the situation and what to do.
4. **Given** the Donor PWA offline fallback is shown, **When** the user reads the message, **Then** it specifically references the bidding/event context (e.g., "Please reconnect to continue bidding").
5. **Given** the Admin PWA offline fallback is shown, **When** the user reads the message, **Then** it uses admin-appropriate messaging (e.g., "Please reconnect to continue managing your event").

---

### User Story 4 — Smart API Response Caching (Priority: P2)

A donor browsing the auction gallery sees item images and details load quickly on repeat views because previously fetched images are served from cache. When viewing an auction item they looked at earlier, the image appears instantly even if their connection is momentarily slow. API data (bids, registrations, event details) always attempts to fetch fresh data from the network first but falls back to cached data if the network is unavailable or slow.

**Why this priority**: Runtime caching dramatically improves perceived performance, especially for image-heavy experiences like the auction gallery. Network-first caching for API data ensures freshness while providing resilience against connectivity drops.

**Independent Test**: Can be tested by loading the auction gallery, observing image load times on first view, then navigating away and back — images should render instantly from cache. API data freshness can be tested by modifying data on the backend and verifying the donor sees updated data on next load (network-first).

**Acceptance Scenarios**:

1. **Given** a donor has previously viewed the auction gallery, **When** they return to the gallery, **Then** auction item images load instantly from cache without waiting for the network.
2. **Given** a donor is browsing the auction gallery, **When** a new request is made for event or auction data, **Then** the system attempts to fetch fresh data from the network first and only falls back to cached data if the network request fails.
3. **Given** a donor has cached auction data, **When** a new bid has been placed by another user and the donor refreshes, **Then** the donor sees the updated bid data (network-first ensures freshness).
4. **Given** an admin has previously loaded event registrations, **When** they view the same page again, **Then** static assets (images, fonts, logos) load from cache while dynamic data is fetched fresh from the network.
5. **Given** a donor or admin has a momentary network interruption during a data request, **When** the network request fails, **Then** the most recently cached version of that data is displayed with a subtle indicator that the data may not be current.

---

### User Story 5 — Offline Auction Gallery (Donor PWA) (Priority: P3)

A donor who has browsed the auction gallery while connected loses their internet connectivity. Instead of seeing an error or blank page, they can continue browsing previously viewed auction items in a read-only mode. They can see item photos, descriptions, current bid amounts (as of last fetch), and categories. Bidding and other write operations are clearly disabled with a message explaining they need connectivity to place bids.

**Why this priority**: This transforms the donor experience from "broken when offline" to "gracefully degraded." It's particularly valuable at crowded venues where connectivity is unreliable. However, it builds on the caching infrastructure from earlier stories.

**Independent Test**: Can be tested by browsing the auction gallery while online, then toggling airplane mode — previously viewed items should remain visible in a read-only view.

**Acceptance Scenarios**:

1. **Given** a donor has browsed the auction gallery while online, **When** they lose connectivity, **Then** they can continue viewing previously loaded auction items with their images, descriptions, and last-known bid amounts.
2. **Given** a donor is viewing the auction gallery offline, **When** they attempt to place a bid, **Then** the bid button is disabled and a message indicates they must reconnect to place bids.
3. **Given** a donor is viewing the auction gallery offline, **When** they attempt to use "Buy Now," **Then** the button is disabled with a message explaining connectivity is required.
4. **Given** a donor is viewing cached auction data offline, **When** the data is displayed, **Then** a subtle indicator (such as a timestamp) shows when the data was last updated so the donor understands prices may have changed.
5. **Given** a donor is viewing auction items offline, **When** their connectivity is restored, **Then** the gallery automatically refreshes with current data and re-enables bidding controls.

---

### User Story 6 — Native-Like App Experience (Priority: P3)

Both the Admin and Donor PWAs feel like native applications when installed. The status bar matches the app's theme color, the app has proper splash screens during loading, navigation gestures work smoothly, and the app handles orientation changes gracefully. On iOS, the app uses the correct status bar style. On Android, the app integrates with the system back button and recent apps view with the proper app name and icon.

**Why this priority**: These polish elements collectively make the difference between "a website on my home screen" and "this feels like a real app." They're individually small but together create a professional native-like impression.

**Independent Test**: Can be tested by installing the app on iOS and Android devices and verifying visual integration with the OS: splash screen, status bar color, back button behavior, task switcher appearance.

**Acceptance Scenarios**:

1. **Given** a user launches the installed PWA on Android, **When** the app is loading, **Then** a themed splash screen with the FundrBolt logo is displayed while the app initializes.
2. **Given** a user launches the installed PWA on iOS, **When** the app is loading, **Then** an Apple-specific splash screen is displayed using properly configured apple-touch-startup-image assets.
3. **Given** a user has the installed PWA open on Android, **When** they view the status bar, **Then** it uses the app's theme color.
4. **Given** a user switches to the recent apps view on Android, **When** they see the app in the list, **Then** it shows the correct app name and themed header color.
5. **Given** a user opens the installed PWA on a tablet in landscape mode, **When** they rotate the device, **Then** the app layout adapts gracefully without breaking.
6. **Given** the manifest includes properly sized icons, **When** the PWA is installed, **Then** the home screen icon is crisp and correctly sized on all device types (phones and tablets).

---

### Edge Cases

- What happens when the user's device storage is full and the service worker cannot cache assets?
  - The app functions normally as a regular web app — caching fails silently and assets load from the network as they would without a service worker. Runtime caches are also size-capped (50 MB images, 10 MB API responses) to reduce the likelihood of storage exhaustion.
- What happens when an app update is available but the user never closes the app?
  - The service worker detects updated assets in the background and shows a non-blocking "New version available — tap to refresh" notification. If the user does not act within 24 hours, the new version auto-activates on the next navigation to prevent indefinitely stale app code.
- What happens when a user installs the PWA and the domain or URL structure changes?
  - The service worker scope is tied to the domain. When the URL structure changes, the existing service worker cache is invalidated, and the app re-caches with the new asset paths on the next launch.
- What happens when two copies of the app are open in different tabs/windows?
  - The service worker is shared across all tabs. When an update is detected, the "refresh" prompt appears in all open tabs. Only one tab needs to trigger the update.
- What happens on browsers that do not support service workers (e.g., older browsers)?
  - The apps continue functioning as they do today — standard single-page applications without offline or caching capabilities. No errors are shown.
- What happens when a user logs out on a shared device (e.g., check-in tablet)?
  - Caches are not cleared on logout. The network-first strategy for API data ensures the next user's login fetches fresh, authenticated data. Previously cached images (auction items, logos) may persist but contain no personal information.

## Clarifications

### Session 2026-03-05

- Q: Should runtime caches (API responses, images) be cleared when a user logs out, given shared-device scenarios (check-in tablets, borrowed phones)? → A: No — do not clear caches on logout. Rely on network-first strategy to overwrite cached data on the next user's login.
- Q: What happens if a user ignores the "new version available" prompt indefinitely, risking stale app code with incompatible API calls? → A: Prompt first, then auto-update after a timeout (e.g., 24 hours) if the user hasn't refreshed.
- Q: Should runtime caches have a maximum size to prevent filling storage on lower-end mobile devices at events with 100+ auction items? → A: Yes — cap the runtime image cache at 50 MB and the API response cache at 10 MB, evicting oldest entries when exceeded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Both the Admin PWA and Donor PWA MUST register a service worker that precaches the app shell (HTML entry point, CSS bundles, JavaScript bundles, and key static assets such as the logo and icons).
- **FR-002**: Both apps MUST display a user-dismissable install prompt banner when the browser's `beforeinstallprompt` event fires, offering to add the app to the user's home screen.
- **FR-003**: The install prompt MUST NOT reappear for at least 7 days after a user dismisses it, using local persistence to track dismissal.
- **FR-004**: The install prompt MUST NOT appear if the app is already running in standalone or installed mode.
- **FR-005**: Both apps MUST serve a branded offline fallback page when a navigation request fails due to lack of connectivity.
- **FR-006**: The offline fallback page MUST display the FundrBolt logo, branding colors, a friendly message, and a call-to-action to reconnect.
- **FR-007**: The Donor PWA MUST use a cache-first strategy for image assets (auction item photos, sponsor logos, event banners) so that previously loaded images render instantly on repeat views.
- **FR-008**: Both apps MUST use a network-first strategy for API responses, falling back to cached responses only when the network request fails.
- **FR-009**: The Donor PWA MUST allow users to browse previously cached auction items in a read-only mode when offline, with bidding and purchase controls disabled.
- **FR-010**: When cached data is displayed due to a network failure, the app MUST show a visual indicator that the data may be stale, including the time it was last fetched.
- **FR-011**: When a new version of the app is deployed, the service worker MUST detect updated assets and present the user with a non-blocking "New version available" notification with an option to refresh. If the user does not refresh within 24 hours, the service worker MUST automatically activate the new version on the next navigation.
- **FR-012**: Both apps MUST include properly sized icons in the web app manifest to meet installability requirements on both Android and iOS (minimum: 192×192 and 512×512 PNG icons, plus a maskable icon variant).
- **FR-013**: Both apps MUST include Apple-specific meta tags and configuration (apple-touch-icon, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style) for proper iOS home screen integration.
- **FR-014**: The web app manifests MUST declare an appropriate theme color that matches the app's brand, used for the Android status bar and splash screen.
- **FR-015**: Both apps MUST cache Google Fonts using a StaleWhileRevalidate runtime caching strategy so that typography renders from cache on repeat visits without font-swap flicker. (Note: true precaching is not feasible for external CDN resources; runtime caching achieves the same user-facing result after first load.)
- **FR-016**: The Donor PWA MUST display a persistent connection status indicator when the device is offline, informing the user that some features are unavailable.
- **FR-017**: When a user regains connectivity after being offline, the app MUST automatically refresh stale data and re-enable any disabled controls (e.g., bid buttons) without requiring a manual page reload.
- **FR-018**: The runtime image cache MUST be limited to a maximum of 200 entries and the API response cache MUST be limited to a maximum of 100 entries, with LRU (least recently used) eviction when limits are exceeded. Both caches MUST set `purgeOnQuotaError: true` to gracefully handle device storage pressure. These entry counts approximate 50 MB and 10 MB respectively for typical auction item images (~250 KB each) and API JSON responses (~100 KB each).

### Key Entities

- **Service Worker**: A background script registered by each PWA that intercepts network requests, manages the cache, and enables offline functionality. One service worker per app domain.
- **Precache Manifest**: The list of app shell assets (HTML, CSS, JS bundles, icons, fonts) that are cached during service worker installation, ensuring the app loads without network access.
- **Runtime Cache**: Dynamically cached responses from API endpoints and image URLs, managed with strategy-specific rules (cache-first for images, network-first for data).
- **Install Prompt**: A UI banner component that captures the browser's `beforeinstallprompt` event and presents a branded installation call-to-action to the user.
- **Offline Fallback Page**: A static HTML page stored in the precache that is served as a response to navigation requests when the user is offline and the requested page is not cached.
- **Update Notification**: A UI component that appears when the service worker detects a new version of the app, offering the user the choice to reload and receive the update.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both apps pass the "Installable" audit in a standard PWA assessment (e.g., Lighthouse PWA checks) with no critical failures.
- **SC-002**: After first load, the app shell of both apps renders on repeat visits in under 1 second, even on a simulated slow 3G connection.
- **SC-003**: When offline, 100% of navigation attempts within either app show the branded offline fallback page instead of the browser's default error page.
- **SC-004**: Previously viewed auction item images in the Donor PWA load instantly (under 200 milliseconds perceived) on repeat views due to cache-first image caching.
- **SC-005**: Users who have previously visited the Donor PWA can browse at least their most recently viewed auction items while fully offline, in read-only mode with all write controls disabled.
- **SC-006**: When a new version is deployed, 90% or more of active users receive the update notification within 24 hours of their next app open.
- **SC-007**: The install prompt achieves a minimum 10% engagement rate (users who tap "Install" out of users who see the prompt) during live demo or event scenarios.
- **SC-008**: Both apps display correctly with native-like appearance (themed status bar, correct icon, no browser chrome) when launched from the home screen on Android and iOS devices.

## Assumptions

- Both apps will continue to use Vite as the build tool, making `vite-plugin-pwa` the natural choice for service worker generation during planning and implementation.
- The existing `manifest.json` files in both apps will be enhanced rather than replaced, preserving current metadata while adding required PWA fields.
- Icon assets at the required sizes (192×192, 512×512, maskable) either already exist or will be generated as part of this feature's implementation.
- The backend API endpoints that the Donor PWA caches for offline auction browsing are the existing gallery/item list endpoints — no new backend work is needed for read-only offline data.
- Users are expected to have modern browsers (Chrome 80+, Safari 14+, Firefox 80+, Edge 80+) that support service workers and the Web App Manifest specification.
- The 7-day dismissal cooldown for the install prompt is stored in `localStorage`, scoped per app (Admin vs. Donor), and is a reasonable default balancing user experience with install conversion.
- Apple/iOS PWA support is limited by platform constraints (no push notifications, limited background sync). The specification focuses on what is achievable within current iOS PWA capabilities.
- Cached data is not cleared on logout. The network-first caching strategy for API responses ensures that the next authenticated session fetches fresh data, making explicit cache clearing unnecessary for data correctness.
