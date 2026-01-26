import { useContext } from 'react'
import { EventWorkspaceContext } from './EventWorkspaceContext'

export function useEventWorkspace() {
  const context = useContext(EventWorkspaceContext)
  if (!context) {
    throw new Error('useEventWorkspace must be used within an EventWorkspaceProvider')
  }
  return context
}
