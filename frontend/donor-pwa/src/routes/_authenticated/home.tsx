import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createFileRoute } from '@tanstack/react-router'
import { Calendar, Heart, Users } from 'lucide-react'

/**
 * Donor PWA Home Page
 * Simple welcome page for donors with quick links
 */
function DonorHomePage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Augeo</h1>
        <p className="text-muted-foreground mt-2">
          Discover events, register, and support nonprofit organizations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>Browse Events</CardTitle>
            </div>
            <CardDescription>
              Find upcoming fundraising events and galas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/events" className="text-primary hover:underline">
              View all events →
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <CardTitle>My Registrations</CardTitle>
            </div>
            <CardDescription>
              View your upcoming event registrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/registrations" className="text-primary hover:underline">
              View registrations →
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Organizations</CardTitle>
            </div>
            <CardDescription>
              Explore nonprofit organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/npos" className="text-primary hover:underline">
              Browse organizations →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/home')({
  component: DonorHomePage,
})
