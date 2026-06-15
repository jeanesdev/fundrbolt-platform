import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { PasswordResetConfirm } from '@/features/auth/password-reset-confirm'

const searchSchema = z.object({
  token: z.string().optional(),
  mode: z.enum(['setup']).optional(),
})

function PasswordResetConfirmRoute() {
  const { token, mode } = Route.useSearch()
  return <PasswordResetConfirm token={token} mode={mode} />
}

export const Route = createFileRoute('/(auth)/password-reset-confirm')({
  component: PasswordResetConfirmRoute,
  validateSearch: searchSchema,
})
