export interface UpdateNotificationProps {
  /** Whether a new version is waiting to be activated */
  needRefresh: boolean
  /** Called when the user taps "Refresh" to activate the new version */
  onRefresh: () => Promise<void>
  /** Called when the user dismisses the notification */
  onDismiss: () => void
}

/**
 * Non-blocking toast/banner shown at the top of the viewport
 * when a new app version is available.
 */
export function UpdateNotification({
  needRefresh,
  onRefresh,
  onDismiss,
}: UpdateNotificationProps) {
  if (!needRefresh) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 animate-in slide-in-from-top duration-300"
      role="alert"
    >
      <div className="border-b border-blue-200 bg-blue-50 px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <p className="text-sm font-medium text-blue-800">
            A new version is available.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void onRefresh()}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
            >
              Refresh to update
            </button>
            <button
              onClick={onDismiss}
              className="rounded-full p-1 text-blue-400 transition-colors hover:text-blue-600"
              aria-label="Dismiss update notification"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
