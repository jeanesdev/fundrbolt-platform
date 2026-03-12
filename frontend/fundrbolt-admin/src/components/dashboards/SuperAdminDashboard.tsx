/**
 * SuperAdmin Dashboard
 *
 * Displayed to users with super_admin role.
 * Provides platform-wide overview and management capabilities.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { eventApi } from '@/services/event-service'
import { npoApi } from '@/services/npo-service'
import { useAuth } from '@/hooks/use-auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { listUsers } from '@/features/users/api/users-api'

export function SuperAdminDashboard() {
  const { user } = useAuth()

  const orgsQuery = useQuery({
    queryKey: ['npos', 'total'],
    queryFn: () => npoApi.listNPOs({ page: 1, page_size: 1 }),
  })

  const eventsQuery = useQuery({
    queryKey: ['events', 'total', null],
    queryFn: () => eventApi.listEvents({ page: 1, page_size: 1 }),
  })

  const usersQuery = useQuery({
    queryKey: ['users', 'total'],
    queryFn: () => listUsers({ page: 1, page_size: 1 }),
  })

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>SuperAdmin Dashboard</h1>
        <p className='text-muted-foreground mt-2'>
          Welcome back, {user?.first_name}! You have full platform access.
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>Active nonprofit organizations</CardDescription>
          </CardHeader>
          <CardContent>
            {orgsQuery.isLoading ? (
              <Skeleton className='h-10 w-16' />
            ) : (
              <div className='text-4xl font-bold'>
                {orgsQuery.data?.total ?? '--'}
              </div>
            )}
            <p className='text-muted-foreground mt-2 text-xs'>
              Platform-wide statistics
            </p>
            <Link
              to='/npos'
              className='text-primary mt-3 block text-sm font-medium hover:underline'
            >
              Go to Organizations →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Events</CardTitle>
            <CardDescription>Across all organizations</CardDescription>
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
              All fundraising events
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
            <CardTitle>Total Users</CardTitle>
            <CardDescription>Platform users</CardDescription>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <Skeleton className='h-10 w-16' />
            ) : (
              <div className='text-4xl font-bold'>
                {usersQuery.data?.total ?? '--'}
              </div>
            )}
            <p className='text-muted-foreground mt-2 text-xs'>
              Administrators and donors
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
