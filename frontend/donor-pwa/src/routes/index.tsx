import { PublicDirectoryExplorer } from '@/components/home/public-directory-explorer'
import { LegalFooter } from '@/components/legal/legal-footer'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import LogoWhiteGold from '@fundrbolt/shared/assets/logos/fundrbolt-logo-white-gold.svg'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'

function HomePage() {
  return (
    <div className='from-background to-secondary/20 flex min-h-screen flex-col bg-gradient-to-b'>
      {/* Hero Section — dark background so white logo is visible */}
      <div className='bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white'>
        <div className='container mx-auto px-4 py-20 text-center'>
          <div className='mb-8 flex justify-center'>
            <img src={LogoWhiteGold} alt='FundrBolt' className='h-16' />
          </div>
          <h1 className='mb-4 text-5xl font-bold'>Welcome to FundrBolt!</h1>
          <p className='mb-8 text-xl text-white/70'>
            Support nonprofits, attend events, and make a difference
          </p>
          <div className='flex justify-center gap-4'>
            <Button asChild size='lg'>
              <Link to='/sign-up'>Get Started</Link>
            </Button>
            <Button
              asChild
              variant='outline'
              size='lg'
              className='border-white/40 text-white hover:bg-white/10'
            >
              <Link to='/sign-in'>Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
      <div className='container mx-auto flex-1 px-4 py-16'>
        <div className='mx-auto grid max-w-5xl gap-6 md:grid-cols-3'>
          <Card>
            <CardHeader>
              <CardTitle>Browse Events</CardTitle>
              <CardDescription>
                Discover fundraising events and galas near you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant='ghost' className='w-full'>
                <Link to='/sign-in' search={{ redirect: '/events' }}>
                  View Events
                </Link>
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
              <Button asChild variant='ghost' className='w-full'>
                <Link to='/sign-in' search={{ redirect: '/npos' }}>
                  Explore Organizations
                </Link>
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
              <Button asChild variant='ghost' className='w-full'>
                <Link to='/sign-up'>Join Now</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className='mx-auto mt-16 max-w-6xl'>
          <PublicDirectoryExplorer
            title='Browse Events and Organizations'
            description='Search participating organizations and upcoming events before you sign in.'
          />
        </div>
      </div>

      <LegalFooter />
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
