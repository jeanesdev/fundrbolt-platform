import { WifiOff } from 'lucide-react'

export interface OfflineStatusBarProps {
  isOnline: boolean
}

/**
 * Persistent slim bar at the top of the viewport when the device is offline.
 * Slides away when connectivity is restored.
 */
export function OfflineStatusBar({ isOnline }: OfflineStatusBarProps) {
  if (isOnline) return null

  return (
    <div
      className="animate-in slide-in-from-top sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-medium text-white duration-200"
      role="alert"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      You're offline — some features may be unavailable
    </div>
  )
}
