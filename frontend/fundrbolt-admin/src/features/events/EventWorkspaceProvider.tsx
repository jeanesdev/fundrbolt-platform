import type { ReactNode } from 'react'
import { EventWorkspaceContext, type EventWorkspaceContextValue } from './EventWorkspaceContext'

interface EventWorkspaceProviderProps {
  value: EventWorkspaceContextValue
  children: ReactNode
}

export function EventWorkspaceProvider({ value, children }: EventWorkspaceProviderProps) {
  return <EventWorkspaceContext.Provider value={value}>{children}</EventWorkspaceContext.Provider>
}
