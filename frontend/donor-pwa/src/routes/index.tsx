import { useAuthStore } from '@/stores/auth-store'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">Welcome to Augeo</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Support nonprofits, attend events, and make a difference
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/sign-up">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Browse Events</CardTitle>
              <CardDescription>
                Discover fundraising events and galas near you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/sign-in" search={{ redirect: '/events' }}>View Events</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support NPOs</CardTitle>
              <CardDescription>
                Connect with nonprofits making an impact
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/sign-in" search={{ redirect: '/npos' }}>Explore Organizations</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Register Today</CardTitle>
              <CardDescription>
                Create an account to participate in events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/sign-up">Join Now</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { isAuthenticated } = useAuthStore.getState()
    const hasRefreshToken = hasValidRefreshToken()

    // If user is authenticated or has a valid refresh token, redirect to home
    if (isAuthenticated || hasRefreshToken) {
      throw redirect({
        to: '/home',
      })
    }
  },
  component: HomePage,
})
