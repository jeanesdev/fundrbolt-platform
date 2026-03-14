import { CompleteProfile } from '@/features/auth/complete-profile'
import { useAuthStore } from '@/stores/auth-store'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/complete-profile')({
  validateSearch: searchSchema,
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: CompleteProfile,
})
