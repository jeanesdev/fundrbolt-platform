/**
 * CookieConsentBanner component
 * Banner displayed on first visit to collect cookie consent
 */

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useCookieStore } from '@/stores/cookie-store'
import { Cookie } from 'lucide-react'
import { useState } from 'react'

interface CookieConsentBannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CookieConsentBanner({ open, onOpenChange }: CookieConsentBannerProps) {
  const { setConsent, acceptAll, rejectAll, isLoading } = useCookieStore()
  const [showCustomize, setShowCustomize] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  const handleAcceptAll = async () => {
    await acceptAll()
    onOpenChange(false)
  }

  const handleRejectAll = async () => {
    await rejectAll()
    onOpenChange(false)
  }

  const handleSavePreferences = async () => {
    await setConsent({ analytics, marketing })
    onOpenChange(false)
  }

  if (!showCustomize) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <Cookie className="h-5 w-5" />
              <AlertDialogTitle>Cookie Preferences</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left">
              We use cookies to enhance your browsing experience, serve personalized content,
              and analyze our traffic. By clicking "Accept All", you consent to our use of
              cookies.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="font-semibold mb-2">🍪 What are cookies?</h4>
              <p className="text-sm text-muted-foreground">
                Cookies are small text files stored on your device that help us provide you
                with a better experience. Some cookies are essential for the site to work,
                while others help us improve our services.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">Essential Cookies</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Required for the website to function properly. Always enabled.
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">Required</span>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">Analytics Cookies</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Help us understand how visitors interact with our website.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">Marketing Cookies</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Used to track visitors and display relevant advertisements.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleRejectAll}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Reject All
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCustomize(true)}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Customize
            </Button>
            <Button
              onClick={handleAcceptAll}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? 'Saving...' : 'Accept All'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Cookie className="h-5 w-5" />
            <AlertDialogTitle>Customize Cookie Preferences</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Choose which types of cookies you want to allow. Essential cookies cannot be
            disabled as they are required for the site to function.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Essential - Always enabled */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
            <Checkbox checked disabled className="mt-1" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">Essential Cookies</h4>
              <p className="text-sm text-muted-foreground">
                These cookies are necessary for the website to function and cannot be
                switched off. They are usually only set in response to actions made by you
                such as setting your privacy preferences, logging in, or filling in forms.
              </p>
              <span className="text-xs font-medium text-primary mt-2 inline-block">
                Always Active
              </span>
            </div>
          </div>

          {/* Analytics */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
            <Checkbox
              checked={analytics}
              onCheckedChange={(checked) => setAnalytics(checked === true)}
              className="mt-1"
              id="analytics"
            />
            <div className="flex-1">
              <label htmlFor="analytics" className="cursor-pointer">
                <h4 className="font-semibold text-sm mb-1">Analytics Cookies</h4>
                <p className="text-sm text-muted-foreground">
                  These cookies allow us to count visits and traffic sources so we can
                  measure and improve the performance of our site. They help us know which
                  pages are the most and least popular.
                </p>
              </label>
            </div>
          </div>

          {/* Marketing */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
            <Checkbox
              checked={marketing}
              onCheckedChange={(checked) => setMarketing(checked === true)}
              className="mt-1"
              id="marketing"
            />
            <div className="flex-1">
              <label htmlFor="marketing" className="cursor-pointer">
                <h4 className="font-semibold text-sm mb-1">Marketing Cookies</h4>
                <p className="text-sm text-muted-foreground">
                  These cookies may be set through our site by our advertising partners.
                  They may be used to build a profile of your interests and show you
                  relevant ads on other sites.
                </p>
              </label>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCustomize(false)}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Back
          </Button>
          <Button
            onClick={handleSavePreferences}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Saving...' : 'Save Preferences'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
