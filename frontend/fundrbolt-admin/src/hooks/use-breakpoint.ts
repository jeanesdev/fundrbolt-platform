import * as React from 'react'

/**
 * Breakpoint tiers for responsive layout adaptation.
 *
 * - phone:            < 768px
 * - tablet-portrait:  768–1023px
 * - tablet-landscape: 1024–1366px
 * - desktop:          ≥ 1367px
 */
export type BreakpointTier =
  | 'phone'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'desktop'

const BREAKPOINTS = {
  TABLET: 768,
  LANDSCAPE: 1024,
  DESKTOP: 1367,
} as const

function getTier(width: number): BreakpointTier {
  if (width < BREAKPOINTS.TABLET) return 'phone'
  if (width < BREAKPOINTS.LANDSCAPE) return 'tablet-portrait'
  if (width < BREAKPOINTS.DESKTOP) return 'tablet-landscape'
  return 'desktop'
}

/**
 * Returns the current breakpoint tier based on viewport width.
 * Uses `window.matchMedia` listeners to respond to resize/orientation changes.
 */
export function useBreakpoint(): BreakpointTier {
  const [tier, setTier] = React.useState<BreakpointTier>(() =>
    typeof window !== 'undefined' ? getTier(window.innerWidth) : 'desktop'
  )

  React.useEffect(() => {
    const mqTablet = window.matchMedia(`(min-width: ${BREAKPOINTS.TABLET}px)`)
    const mqLandscape = window.matchMedia(
      `(min-width: ${BREAKPOINTS.LANDSCAPE}px)`
    )
    const mqDesktop = window.matchMedia(`(min-width: ${BREAKPOINTS.DESKTOP}px)`)

    const update = () => setTier(getTier(window.innerWidth))

    mqTablet.addEventListener('change', update)
    mqLandscape.addEventListener('change', update)
    mqDesktop.addEventListener('change', update)

    // Sync initial value
    update()

    return () => {
      mqTablet.removeEventListener('change', update)
      mqLandscape.removeEventListener('change', update)
      mqDesktop.removeEventListener('change', update)
    }
  }, [])

  return tier
}

/**
 * Returns `true` when the viewport matches either tablet tier
 * (portrait or landscape).
 */
export function useIsTablet(): boolean {
  const tier = useBreakpoint()
  return tier === 'tablet-portrait' || tier === 'tablet-landscape'
}
