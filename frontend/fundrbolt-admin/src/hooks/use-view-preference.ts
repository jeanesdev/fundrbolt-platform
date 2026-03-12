import * as React from 'react'
import { useLocation } from '@tanstack/react-router'
import { useBreakpoint } from './use-breakpoint'

const STORAGE_KEY = 'fundrbolt_view_prefs'

export type ViewMode = 'table' | 'card'

function readPrefs(): Record<string, ViewMode> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ViewMode>) : {}
  } catch {
    return {}
  }
}

function writePrefs(prefs: Record<string, ViewMode>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage may be full or disabled — silently ignore
  }
}

/**
 * Per-page view preference hook.
 *
 * Returns `[viewMode, setViewMode]` where:
 * - Default is `'card'` on viewports narrower than tablet-landscape (< 1024px),
 *   `'table'` on wider viewports — unless an explicit preference is stored.
 * - Explicit changes are persisted to localStorage keyed by the current page path.
 *
 * @param pageKey Optional override for the localStorage key (defaults to current route pathname).
 */
export function useViewPreference(
  pageKey?: string
): [ViewMode, (mode: ViewMode) => void] {
  const pathname = useLocation({ select: (loc) => loc.pathname })
  const key = pageKey ?? pathname
  const tier = useBreakpoint()

  const defaultMode: ViewMode =
    tier === 'phone' ||
    tier === 'tablet-portrait' ||
    tier === 'tablet-landscape'
      ? 'card'
      : 'table'

  const [mode, setModeState] = React.useState<ViewMode>(() => {
    const prefs = readPrefs()
    return prefs[key] ?? defaultMode
  })

  // Sync with default when breakpoint changes and no stored preference exists
  React.useEffect(() => {
    const prefs = readPrefs()
    if (!(key in prefs)) {
      setModeState(defaultMode)
    }
  }, [defaultMode, key])

  const setMode = React.useCallback(
    (newMode: ViewMode) => {
      setModeState(newMode)
      const prefs = readPrefs()
      prefs[key] = newMode
      writePrefs(prefs)
    },
    [key]
  )

  return [mode, setMode]
}
