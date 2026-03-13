import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { buildDonorPortalSignInUrl } from '@/lib/donor-portal'

function DonorPortalRedirectPage() {
  const { email } = Route.useSearch()

  useEffect(() => {
    window.location.replace(buildDonorPortalSignInUrl(email))
  }, [email])

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white'>
      <div className='max-w-md space-y-3'>
        <h1 className='text-2xl font-semibold'>
          Redirecting to the donor portal
        </h1>
        <p className='text-sm text-slate-300'>
          Donor accounts sign in through the donor experience, not the admin
          app.
        </p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/donor-portal-redirect')({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === 'string' ? search.email : undefined,
  }),
  component: DonorPortalRedirectPage,
})
