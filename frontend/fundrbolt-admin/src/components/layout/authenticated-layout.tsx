import { TopNavBar } from '@/components/layout/top-nav-bar'
import { LegalFooter } from '@/components/legal/legal-footer'
import { SkipToMain } from '@/components/skip-to-main'
import { SearchProvider } from '@/context/search-provider'
import { useAuth } from '@/hooks/use-auth'
import { useNpoContext } from '@/hooks/use-npo-context'
import apiClient from '@/lib/axios'
import type { NPOContextOption } from '@/stores/npo-context-store'
import { useQuery } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
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

  // T059: Populate available NPOs including "Fundrbolt Platform" option for SuperAdmin
  useEffect(() => {
    if (nposData?.items) {
      const npoOptions: NPOContextOption[] = []

      // T059: SuperAdmin gets "Fundrbolt Platform" option (null npoId)
      if (isSuperAdmin) {
        npoOptions.push({
          id: null,
          name: 'Fundrbolt Platform',
        })
      }

      // Add all NPOs user has access to
      nposData.items.forEach(
        (npo: { id: string; name: string; logo_url?: string }) => {
          npoOptions.push({
            id: npo.id,
            name: npo.name,
            logo_url: npo.logo_url,
          })
        }
      )

      setAvailableNpos(npoOptions)
    }
  }, [nposData, isSuperAdmin, setAvailableNpos])

  return (
    <SearchProvider>
      <SkipToMain />
      <div className='flex min-h-svh flex-col'>
        <TopNavBar />
        <main className='@container/content flex-1 p-4 sm:p-6'>
          {children ?? <Outlet />}
        </main>
        <LegalFooter />
      </div>
    </SearchProvider>
  )
}
