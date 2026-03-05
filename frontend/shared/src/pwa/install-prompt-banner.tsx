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

  useEffect(() => {
    if (!canShow) return

    const timer = setTimeout(() => {
      setVisible(true)
    }, showDelay)

    return () => clearTimeout(timer)
  }, [canShow, showDelay])

  if (!visible || !canShow) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300"
      role="alert"
    >
      <div className="mx-auto max-w-lg border-t border-slate-200 bg-white p-4 shadow-lg sm:mx-4 sm:mb-4 sm:rounded-xl sm:border">
        <div className="flex items-start gap-3">
          <img
            src="/images/pwa-192x192.png"
            alt="FundrBolt"
            className="h-12 w-12 flex-shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            {isIOS ? (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  Add FundrBolt to your home screen
                </p>
                <p className="mt-1 text-xs text-slate-500">
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
                <p className="text-sm font-semibold text-slate-900">
                  Add FundrBolt to your home screen
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  For the best experience, install the app
                </p>
              </>
            )}

            {!isIOS && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void promptInstall()}
                  className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
                >
                  Install
                </button>
                <button
                  onClick={dismiss}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
                >
                  Not now
                </button>
              </div>
            )}
          </div>

          <button
            onClick={dismiss}
            className="flex-shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:text-slate-600"
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
