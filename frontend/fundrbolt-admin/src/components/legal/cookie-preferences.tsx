/**
 * CookiePreferences component
 * Settings page for managing cookie consent preferences
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useCookieStore } from '@/stores/cookie-store'
import { BarChart3, Cookie, Loader2, Megaphone, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function CookiePreferences() {
  const { preferences, hasConsent, updateConsent, isLoading, fetchConsent } = useCookieStore()

  const [analytics, setAnalytics] = useState(preferences.analytics)
  const [marketing, setMarketing] = useState(preferences.marketing)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchConsent()
  }, [fetchConsent])

  useEffect(() => {
    setAnalytics(preferences.analytics)
    setMarketing(preferences.marketing)
  }, [preferences])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateConsent({ analytics, marketing })
      toast.success('Cookie preferences updated successfully')
    } catch (_error) {
      toast.error('Failed to update cookie preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges =
    analytics !== preferences.analytics || marketing !== preferences.marketing

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Cookie Preferences</h2>
        <p className="text-muted-foreground">
          Manage how we use cookies and similar technologies on our platform.
        </p>
      </div>

      {!hasConsent && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Cookie className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                  No preferences set
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  You haven't set your cookie preferences yet. By default, only essential
                  cookies are enabled.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Essential Cookies */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-1" />
            <div className="flex-1">
              <CardTitle className="text-lg">Essential Cookies</CardTitle>
              <CardDescription className="mt-2">
                These cookies are necessary for the website to function and cannot be
                disabled. They are usually only set in response to actions made by you such
                as setting your privacy preferences, logging in, or filling in forms.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked disabled />
              <span className="text-sm font-medium text-muted-foreground">Always Active</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Examples:</strong> Authentication tokens, session management, security
              features
            </p>
            <p>
              <strong>Storage:</strong> These cookies are stored locally in your browser and
              are deleted when you close your session or logout.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Cookies */}
      <Card className={analytics ? 'border-primary/50' : ''}>
        <CardHeader>
          <div className="flex items-start gap-3">
            <BarChart3 className="h-5 w-5 text-blue-600 mt-1" />
            <div className="flex-1">
              <CardTitle className="text-lg">Analytics Cookies</CardTitle>
              <CardDescription className="mt-2">
                These cookies allow us to count visits and traffic sources so we can measure
                and improve the performance of our site. They help us know which pages are
                the most and least popular and see how visitors move around the site.
              </CardDescription>
            </div>
            <Checkbox
              checked={analytics}
              onCheckedChange={(checked) => setAnalytics(checked === true)}
              id="analytics-checkbox"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Examples:</strong> Google Analytics, page view tracking, user behavior
              analysis
            </p>
            <p>
              <strong>Purpose:</strong> Help us understand how you use our platform to
              improve user experience and identify issues.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Marketing Cookies */}
      <Card className={marketing ? 'border-primary/50' : ''}>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Megaphone className="h-5 w-5 text-purple-600 mt-1" />
            <div className="flex-1">
              <CardTitle className="text-lg">Marketing Cookies</CardTitle>
              <CardDescription className="mt-2">
                These cookies may be set through our site by our advertising partners. They
                may be used to build a profile of your interests and show you relevant ads
                on other sites. They work by uniquely identifying your browser and device.
              </CardDescription>
            </div>
            <Checkbox
              checked={marketing}
              onCheckedChange={(checked) => setMarketing(checked === true)}
              id="marketing-checkbox"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Examples:</strong> Advertising networks, remarketing tags, conversion
              tracking
            </p>
            <p>
              <strong>Purpose:</strong> Show you relevant advertisements and measure the
              effectiveness of our marketing campaigns.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          Changes will take effect immediately after saving.
        </p>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
      </div>
    </div>
  )
}
