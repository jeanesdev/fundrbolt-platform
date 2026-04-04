import { lazy, Suspense } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PlusCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Lazy load dashboard components for better performance
const SuperAdminDashboard = lazy(() =>
  import('@/components/dashboards/SuperAdminDashboard').then((m) => ({
    default: m.SuperAdminDashboard,
  }))
)
const NpoAdminDashboard = lazy(() =>
  import('@/components/dashboards/NpoAdminDashboard').then((m) => ({
    default: m.NpoAdminDashboard,
  }))
)
const AuctioneerDashboard = lazy(() =>
  import('@/components/dashboards/AuctioneerDashboard').then((m) => ({
    default: m.AuctioneerDashboard,
  }))
)
const EventDashboard = lazy(() =>
  import('@/components/dashboards/EventDashboard').then((m) => ({
    default: m.EventDashboard,
  }))
)

function DashboardPage() {
  const { role, user } = useAuth()
  const navigate = useNavigate()

  // Loading fallback
  const loadingFallback = (
    <Card>
      <CardContent className='pt-6'>
        <div className='flex items-center justify-center p-8'>
          <p className='text-muted-foreground'>Loading dashboard...</p>
        </div>
      </CardContent>
    </Card>
  )

  // Only show "Create Organization" for users with no privileged role and no memberships.
  // Users with a role (npo_admin, event_coordinator, staff, super_admin) already belong to
  // an org — even if memberships aren't yet reflected in the session, their role is authoritative.
  const isPrivilegedRole =
    role === 'super_admin' ||
    role === 'npo_admin' ||
    role === 'event_coordinator' ||
    role === 'staff'

  if (
    !isPrivilegedRole &&
    user &&
    Array.isArray(user.npo_memberships) &&
    user.npo_memberships.length === 0
  ) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center'>
        <Card className='w-full max-w-xl p-8 text-center'>
          <CardHeader>
            <CardTitle className='flex items-center justify-center gap-2 text-2xl'>
              <PlusCircle className='text-primary size-6' />
              Get Started with FundrBolt
            </CardTitle>
            <CardDescription>
              Welcome! To begin using the platform, create your first
              organization.
              <br />
              This will unlock event management, auctions, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-6'>
              <Button
                size='lg'
                className='w-full text-base font-semibold'
                onClick={() => navigate({ to: '/register-npo' })}
              >
                <PlusCircle className='mr-2 size-5' />
                Create an Organization
              </Button>
              <div className='text-muted-foreground pt-2 text-sm'>
                Need help? See our{' '}
                <a
                  href='https://help.fundrbolt.com/getting-started'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary underline'
                >
                  Getting Started Guide
                </a>
                .
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      <Suspense fallback={loadingFallback}>
        {role === 'super_admin' && <SuperAdminDashboard />}
        {role === 'npo_admin' && <NpoAdminDashboard />}
        {role === 'event_coordinator' && <AuctioneerDashboard />}
        {role === 'staff' && <EventDashboard />}
        {/* Donor role is blocked at route level in _authenticated/route.tsx */}
        {!role && (
          <Card>
            <CardContent className='pt-6'>
              <p className='text-muted-foreground'>
                Unable to determine your role. Please contact support.
              </p>
            </CardContent>
          </Card>
        )}
      </Suspense>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})
