/**
 * Event Branding Context
 *
 * Provides event branding state across the event detail routes.
 * Manages CSS variable injection for dynamic theming.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface EventBranding {
  primary_color?: string | null
  secondary_color?: string | null
  logo_url?: string | null
  banner_url?: string | null
}

interface EventBrandingContextValue {
  branding: EventBranding | null
  setBranding: (branding: EventBranding | null) => void
  clearBranding: () => void
}

const EventBrandingContext = createContext<EventBrandingContextValue | undefined>(undefined)

/**
 * Convert hex color (#RRGGBB) to RGB tuple (r, g, b)
 */
function hexToRgb(hex: string): string {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

/**
 * Default Fundrbolt branding colors
 */
const DEFAULT_BRANDING = {
  primary: '59, 130, 246', // blue-500: #3B82F6
  secondary: '147, 51, 234', // purple-600: #9333EA
}

interface EventBrandingProviderProps {
  children: ReactNode
}

export function EventBrandingProvider({ children }: EventBrandingProviderProps) {
  const [branding, setBrandingState] = useState<EventBranding | null>(null)

  const setBranding = (newBranding: EventBranding | null) => {
    setBrandingState(newBranding)

    const root = document.documentElement

    if (!newBranding) {
      root.style.setProperty('--event-primary', DEFAULT_BRANDING.primary)
      root.style.setProperty('--event-secondary', DEFAULT_BRANDING.secondary)
      return
    }

    // Apply primary color
    if (newBranding.primary_color) {
      const primaryRgb = hexToRgb(newBranding.primary_color)
      root.style.setProperty('--event-primary', primaryRgb)
    } else {
      root.style.setProperty('--event-primary', DEFAULT_BRANDING.primary)
    }

    // Apply secondary color
    if (newBranding.secondary_color) {
      const secondaryRgb = hexToRgb(newBranding.secondary_color)
      root.style.setProperty('--event-secondary', secondaryRgb)
    } else {
      root.style.setProperty('--event-secondary', DEFAULT_BRANDING.secondary)
    }
  }

  const clearBranding = () => {
    setBrandingState(null)
    const root = document.documentElement
    root.style.setProperty('--event-primary', DEFAULT_BRANDING.primary)
    root.style.setProperty('--event-secondary', DEFAULT_BRANDING.secondary)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => clearBranding()
  }, [])

  return (
    <EventBrandingContext.Provider value={{ branding, setBranding, clearBranding }}>
      {children}
    </EventBrandingContext.Provider>
  )
}

/**
 * Hook to access event branding context
 */
export function useEventBrandingContext() {
  const context = useContext(EventBrandingContext)
  if (context === undefined) {
    throw new Error('useEventBrandingContext must be used within EventBrandingProvider')
  }
  return context
}
