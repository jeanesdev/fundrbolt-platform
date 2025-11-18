import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { UsersDialogs } from './components/users-dialogs'
import { UsersPrimaryButtons } from './components/users-primary-buttons'
import { UsersProvider } from './components/users-provider'
import { UsersTable } from './components/users-table'
import { useUsers } from './hooks/use-users'

const route = getRouteApi('/_authenticated/users/')

export function Users() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  // Determine is_active filter based on status search param
  // If no status filter, default to showing only active users
  const isActiveFilter =
    search.status && search.status.length > 0
      ? search.status.includes('active') && !search.status.includes('inactive')
        ? true // Only "active" selected
        : !search.status.includes('active') &&
            search.status.includes('inactive')
          ? false // Only "inactive" selected
          : undefined // Both selected or neither (show all)
      : true // Default: show only active users

  // Fetch users from API
  const {
    data: usersData,
    isLoading,
    isError,
  } = useUsers({
    page: search.page || 1,
    page_size: search.pageSize || 10,
    is_active: isActiveFilter,
  })

  // Use API data directly, or empty array if not loaded yet
  const users = usersData?.items || []

  return (
    <UsersProvider>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>User List</h2>
            <p className='text-muted-foreground'>
              Manage your users and their roles here.
            </p>
          </div>
          <UsersPrimaryButtons />
        </div>
        {isLoading && <div>Loading users...</div>}
        {isError && <div>Error loading users. Using mock data.</div>}
        <UsersTable data={users} search={search} navigate={navigate} />
      </Main>

      <UsersDialogs />
    </UsersProvider>
  )
}
