import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { LegalFooter } from '@/components/legal/legal-footer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { SkipToMain } from '@/components/skip-to-main'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { useAuth } from '@/hooks/use-auth'
import { useNpoContext } from '@/hooks/use-npo-context'
import apiClient from '@/lib/axios'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import type { NPOContextOption } from '@/stores/npo-context-store'
import { useQuery } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const { isSuperAdmin, user } = useAuth()
  const { setAvailableNpos } = useNpoContext()

  // T058: Fetch available NPOs on login based on user role
  const { data: nposData } = useQuery({
    queryKey: ['npos', 'available'],
    queryFn: async () => {
      const response = await apiClient.get('/npos')
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!user, // Only fetch when user is authenticated
  })

  // T059: Populate available NPOs including "Augeo Platform" option for SuperAdmin
  useEffect(() => {
    if (nposData?.items) {
      const npoOptions: NPOContextOption[] = []

      // T059: SuperAdmin gets "Augeo Platform" option (null npoId)
      if (isSuperAdmin) {
        npoOptions.push({
          id: null,
          name: 'Augeo Platform',
        })
      }

      // Add all NPOs user has access to
      nposData.items.forEach((npo: { id: string; name: string; logo_url?: string }) => {
        npoOptions.push({
          id: npo.id,
          name: npo.name,
          logo_url: npo.logo_url,
        })
      })

      setAvailableNpos(npoOptions)
    }
  }, [nposData, isSuperAdmin, setAvailableNpos])

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // Flex column layout to push footer to bottom
              'flex flex-col',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-[[data-layout=fixed]]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-[[data-layout=fixed]]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            {/* Persistent Header with Profile Dropdown */}
            <Header fixed>
              <div className='ms-auto flex items-center space-x-4'>
                <Search />
                <ProfileDropdown />
              </div>
            </Header>
            <div className='flex-1 p-4 sm:p-6'>{children ?? <Outlet />}</div>
            <LegalFooter />
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
