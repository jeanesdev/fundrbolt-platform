import { createFileRoute } from '@tantml:react-router'
import { lazy, Suspense } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent } from '@/components/ui/card'

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
  const { role } = useAuth()

  // Loading fallback
  const loadingFallback = (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <Suspense fallback={loadingFallback}>
      {role === 'super_admin' && <SuperAdminDashboard />}
      {role === 'npo_admin' && <NpoAdminDashboard />}
      {role === 'event_coordinator' && <AuctioneerDashboard />}
      {role === 'staff' && <EventDashboard />}
      {/* Donor role is blocked at route level in _authenticated/route.tsx */}
      {!role && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Unable to determine your role. Please contact support.</p>
          </CardContent>
        </Card>
      )}
    </Suspense>
  )
}

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})
