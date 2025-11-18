/**
 * Unauthorized Page (403)
 * 
 * Displayed when a user tries to access a resource they don't have permission for.
 * Primary use case: Donor role attempting to access admin PWA.
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter, useSearch } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'

export function UnauthorizedPage() {
  const router = useRouter()
  const search = useSearch({ strict: false }) as { message?: string }
  
  const defaultMessage = 'You do not have permission to access this area.'
  const message = search?.message || defaultMessage

  const handleGoBack = () => {
    router.history.back()
  }

  const handleGoHome = () => {
    router.navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription className="text-base mt-2">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              If you believe this is an error, please contact your administrator.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleGoBack}>
                Go Back
              </Button>
              <Button onClick={handleGoHome}>
                Go to Home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
