/**
 * NPO Admin Dashboard
 *
 * Displayed to users with npo_admin role.
 * Provides NPO-specific overview and management capabilities.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { eventApi } from '@/services/event-service'
import { memberApi } from '@/services/npo-service'
import { useAuth } from '@/hooks/use-auth'
import { useNpoContext } from '@/hooks/use-npo-context'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { listUsers } from '@/features/users/api/users-api'

export function NpoAdminDashboard() {
  const { user } = useAuth()
  const { selectedNpoId } = useNpoContext()

  const eventsQuery = useQuery({
    queryKey: ['events', 'total', selectedNpoId],
    queryFn: () =>
      eventApi.listEvents({
        npo_id: selectedNpoId ?? undefined,
        page: 1,
        page_size: 1,
      }),
    // Always fetch — backend scopes to the user's NPO when npo_id is omitted.
    // Avoids showing stale "--" when selectedNpoId hasn't been auto-set yet.
    enabled: true,
  })

  const activeEventsQuery = useQuery({
    queryKey: ['events', 'active', selectedNpoId],
    queryFn: () =>
      eventApi.listEvents({
        npo_id: selectedNpoId ?? undefined,
        status: 'active',
        page: 1,
        page_size: 1,
      }),
    enabled: true,
  })

  const membersQuery = useQuery({
    queryKey: ['npo-members', 'active', selectedNpoId],
    queryFn: () =>
      memberApi.listMembers({
        npo_id: selectedNpoId ?? undefined,
        status: 'active',
      }),
    enabled: true,
  })

  const donorsQuery = useQuery({
    queryKey: ['users', 'donors', selectedNpoId],
    queryFn: () =>
      listUsers({
        role: 'donor',
        npo_id: selectedNpoId ?? undefined,
        page: 1,
        page_size: 1,
      }),
    enabled: true,
  })

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>NPO Dashboard</h1>
        <p className='text-muted-foreground mt-2'>
          Welcome back, {user?.first_name}! Manage your organization.
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Your fundraising events</CardDescription>
          </CardHeader>
          <CardContent>
            {eventsQuery.isLoading ? (
              <Skeleton className='h-10 w-16' />
            ) : (
              <div className='text-4xl font-bold'>
                {eventsQuery.data?.total ?? '--'}
              </div>
            )}
            <p className='text-muted-foreground mt-2 text-xs'>
              {activeEventsQuery.isLoading
                ? 'Loading\u2026'
                : `${activeEventsQuery.data?.total ?? 0} currently active`}
            </p>
            <Link
              to='/events'
              className='text-primary mt-3 block text-sm font-medium hover:underline'
            >
              Go to Events →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Your staff and coordinators</CardDescription>
          </CardHeader>
          <CardContent>
            {membersQuery.isLoading ? (
              <Skeleton className='h-10 w-16' />
            ) : (
              <div className='text-4xl font-bold'>
                {membersQuery.data?.total ?? '--'}
              </div>
            )}
            <p className='text-muted-foreground mt-2 text-xs'>
              Active team members
            </p>
            {selectedNpoId && (
              <Link
                to='/npos/$npoId'
                params={{ npoId: selectedNpoId }}
                className='text-primary mt-3 block text-sm font-medium hover:underline'
              >
                Go to Organization →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendees</CardTitle>
            <CardDescription>Registered attendees</CardDescription>
          </CardHeader>
          <CardContent>
            {donorsQuery.isLoading ? (
              <Skeleton className='h-10 w-16' />
            ) : (
              <div className='text-4xl font-bold'>
                {donorsQuery.data?.total ?? '--'}
              </div>
            )}
            <p className='text-muted-foreground mt-2 text-xs'>
              Total registered
            </p>
            <Link
              to='/users'
              className='text-primary mt-3 block text-sm font-medium hover:underline'
            >
              Go to Users →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
