import { createFileRoute } from '@tanstack/react-router'
import { PasswordResetRequest } from '@/features/auth/password-reset'

export const Route = createFileRoute('/(auth)/password-reset')({
  component: PasswordResetRequest,
})
