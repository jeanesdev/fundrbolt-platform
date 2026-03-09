import { useEffect, useState } from 'react'

import { useInstallPrompt } from './use-install-prompt'

export interface InstallPromptBannerProps {
  /** Unique key for localStorage cooldown tracking (e.g., "donor" or "admin") */
  appId: string
  /** Delay in milliseconds before showing the banner after page load. Default: 3000 */
  showDelay?: number
}

/**
 * Bottom-anchored banner prompting the user to install the PWA.
 *
 * On supported browsers, triggers the native install dialog.
 * On iOS, shows manual instructions for adding to home screen.
 * Respects 7-day dismissal cooldown and hides when already installed.
 */
export function InstallPromptBanner({
  appId,
  showDelay = 3000,
}: InstallPromptBannerProps) {
  const { canShow, isIOS, promptInstall, dismiss } = useInstallPrompt(appId)
  const [visible, setVisible] = useState(false)

  const handleDismiss = () => {
    setVisible(false)
    dismiss()
  }

  useEffect(() => {
    if (!canShow) return

    const showTimer = setTimeout(() => {
      setVisible(true)
    }, showDelay)

    return () => clearTimeout(showTimer)
  }, [canShow, showDelay])

  // Auto-dismiss after 5 seconds of being visible
  useEffect(() => {
    if (!visible) return

    const autoDismissTimer = setTimeout(() => {
      setVisible(false)
    }, 5000)

    return () => clearTimeout(autoDismissTimer)
  }, [visible])

  if (!visible || !canShow) return null

  return (
    <div
      className="fixed bottom-4 right-4 left-4 z-50 animate-in slide-in-from-bottom duration-300 sm:left-auto sm:w-80"
      role="alert"
    >
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <img
            src="/images/pwa-192x192.png"
            alt="Fundrbolt"
            className="h-12 w-12 flex-shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            {isIOS ? (
              <>
                <p className="text-sm font-semibold text-white">
                  Add Fundrbolt to your home screen
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Tap the{' '}
                  <span className="inline-flex items-center">
                    <svg
                      className="mx-0.5 inline h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  </span>{' '}
                  share button, then &quot;Add to Home Screen&quot;
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-white">
                  Add Fundrbolt to your home screen
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  For the best experience, install the app
                </p>
              </>
            )}

            {!isIOS && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void promptInstall()}
                  className="rounded-lg bg-white px-4 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-100"
                >
                  Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
                >
                  Not now
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:text-slate-200"
            aria-label="Dismiss install prompt"
          >
            <svg
              className="h-5 w-5"
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
  )
}
