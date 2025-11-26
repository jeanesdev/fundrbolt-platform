/**
 * CheckInLookup Component
 * Allows staff to lookup registrations by confirmation code or email
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { checkinApi, type CheckInLookupResponse } from '@/lib/api/checkin'
import { useState } from 'react'

interface CheckInLookupProps {
  onRegistrationFound: (data: CheckInLookupResponse) => void
}

export function CheckInLookup({ onRegistrationFound }: CheckInLookupProps) {
  const [confirmationCode, setConfirmationCode] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLookupByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmationCode.trim()) {
      setError('Please enter a confirmation code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await checkinApi.lookup({ confirmation_code: confirmationCode })

      if (data.total === 0) {
        setError('No registration found with this confirmation code')
      } else {
        onRegistrationFound(data)
      }
    } catch (err) {
      setError('Error looking up registration. Please try again.')
      console.error('Lookup error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLookupByEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter an email address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await checkinApi.lookup({ email })

      if (data.total === 0) {
        setError('No registrations found for this email address')
      } else {
        onRegistrationFound(data)
      }
    } catch (err) {
      setError('Error looking up registration. Please try again.')
      console.error('Lookup error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Event Check-In</CardTitle>
        <CardDescription>
          Look up a registration by confirmation code or email address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="code" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="code">Confirmation Code</TabsTrigger>
            <TabsTrigger value="email">Email Address</TabsTrigger>
          </TabsList>

          <TabsContent value="code">
            <form onSubmit={handleLookupByCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirmation-code">Confirmation Code</Label>
                <Input
                  id="confirmation-code"
                  type="text"
                  placeholder="Enter confirmation code"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  disabled={loading}
                />
                <p className="text-sm text-muted-foreground">
                  The confirmation code can be found in the registration email
                </p>
              </div>

              {error && (
                <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Looking up...' : 'Look Up Registration'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="email">
            <form onSubmit={handleLookupByEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <p className="text-sm text-muted-foreground">
                  Enter the email address used for registration
                </p>
              </div>

              {error && (
                <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Looking up...' : 'Look Up Registration'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
