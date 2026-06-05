import { useEffect, useState } from 'react'
import { z } from 'zod'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
import { Loader2 } from 'lucide-react'

const searchSchema = z.object({
  token: z.string().optional(),
  redirect: z.string().optional(),
})

interface LoginResponse {
  access_token: string
  refresh_token: string
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    role: string
    npo_id: string | null
    has_local_password?: boolean
    phone?: string | null
    profile_picture_url?: string | null
    email_verified?: boolean
  }
}

function MagicLoginRoute() {
  const { token, redirect } = Route.useSearch()
  const navigate = useNavigate()
  const loginWithTokens = useAuthStore((s) => s.loginWithTokens)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invalid magic link — no token found.')
      return
    }

    apiClient
      .post<LoginResponse>('/auth/magic-link', { token })
      .then(({ data }) => {
        loginWithTokens(data.access_token, data.refresh_token, data.user)
        const destination = redirect ?? '/'
        const destUrl = new URL(destination, window.location.origin)
        navigate({
          to: destUrl.pathname,
          search: Object.fromEntries(destUrl.searchParams) as Record<
            string,
            string
          >,
        })
      })
      .catch(() => {
        setError(
          'This link has expired or has already been used. Please request a new invitation.'
        )
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className='flex min-h-screen items-center justify-center p-6'>
        <div className='max-w-sm text-center'>
          <p className='text-destructive font-medium'>Link expired</p>
          <p className='text-muted-foreground mt-2 text-sm'>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex min-h-screen items-center justify-center'>
      <div className='flex flex-col items-center gap-3'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
        <p className='text-muted-foreground text-sm'>Signing you in…</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/(auth)/magic-login')({
  component: MagicLoginRoute,
  validateSearch: searchSchema,
})
